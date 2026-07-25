import {
    getDocs,
    getDocsFromCache,
    getDocsFromServer,
    limit,
    orderBy,
    query,
    startAfter,
    Timestamp,
    where,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapActiveTransactions,
    readHouseholdDataVersionPreferServer,
    Transaction,
    type FirestoreQuery,
    type FirestoreQueryDocSnapshot,
    type FirestoreQuerySnapshot,
} from "@/lib/firestore";
import {
    buildPaginatedTransactionsScopeKey,
    pickNewestDataVersion,
    shouldFetchAllTransactions,
} from "@/lib/paginatedTransactionsMode";
import {
    getLocalWriteEpoch,
    isLocalWriteEpochCurrent,
} from "@/lib/localWriteEpoch";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";
import {
    isReadComplete,
    pickFirstPaintSource,
    type FirstPaintSource,
} from "@/lib/transactionReadPlan";
import {
    getPersistedScopeDocCount,
    getPersistedScopeVersion,
    loadScopeVersions,
    setPersistedScopeVersion,
} from "@/lib/scopeVersionStore";
import { mergeTransactionCacheItems } from "@/lib/transactionCacheMerge";
import { areTransactionListsEquivalent } from "@/lib/transactionListIdentity";
import { isDeletedTransactionData } from "@/lib/transactionSoftDelete";

export const TRANSACTIONS_PAGE_SIZE = 100;

export type PaginatedTransactionsRange = {
  from: string | null;
  to: string | null;
};

export type PaginatedTransactions = {
  items: Transaction[];
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /**
   * いま `items` に入っている配列が、現在の日付範囲に対する全件か（ADR の R8）。
   *
   * 検索結果の合計を表示してよいかの判定に使う。ページング読みの先頭ページから
   * 合計を出すと、部分集計を全体の合計として表示することになる。
   * 「読み込み中か」ではなくこちらで判定する。
   */
  itemsComplete: boolean;
  loadMore: () => void;
  refresh: () => void;
  refreshIfStale: () => void;
};

export type PaginatedTransactionsOptions = {
  readAll?: boolean;
};

type CachedPage = {
  items: Transaction[];
  version: DataVersion;
  lastDoc: FirestoreQueryDocSnapshot | null;
  hasMore: boolean;
  /** このエントリを作った時点の、端末自身の書き込みカウンタ（ADR の R1）。 */
  epoch: number;
};

const firstPageCache = new Map<string, CachedPage>();
const currentVersionByHousehold = new Map<string, DataVersion>();

function dataVersionToTimestamp(version: DataVersion): Timestamp | null {
  if (!version) return null;
  const millis = Number(version);
  if (Number.isFinite(millis)) return Timestamp.fromMillis(millis);
  const date = new Date(version);
  if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  return null;
}

async function getQuerySnapshot(
  targetQuery: FirestoreQuery,
  source: "cache" | "server",
): Promise<FirestoreQuerySnapshot | null> {
  try {
    return source === "cache"
      ? await getDocsFromCache(targetQuery)
      : await getDocsFromServer(targetQuery);
  } catch (error) {
    if (source === "cache") return null;
    throw error;
  }
}

/**
 * 取引コレクションを日付降順でカーソルページング取得する。
 * 全件購読は大量データ（数千〜万件）でJSスレッドを固めるため、
 * 履歴リストはこのフックで「初回100件＋スクロールで追加100件」読みにする。
 *
 * - リアルタイム購読ではなく `.get()` ベース。最新反映は refresh() / 画面フォーカス時に行う。
 * - 日付範囲（検索条件）が指定された場合はサーバー側 where で絞り込む（date 単一フィールドのため複合インデックス不要）。
 */
export function usePaginatedTransactions(
  householdId: string | null,
  range: PaginatedTransactionsRange,
  options: PaginatedTransactionsOptions = {},
): PaginatedTransactions {
  const [items, setItems] = useState<Transaction[]>([]);
  // マウント直後は必ず初回読み込みが走るため、最初の描画から「読み込み中」で始める。
  // false 始まりだと、世帯ID解決前（householdId が null の間）に
  // 「items 空 かつ 非ローディング」の状態が描画され、
  // 空メッセージが一瞬出てからローディングに切り替わる（Issue #9）。
  // householdId が null の間は下の early return で loadingInitial を倒さず、
  // 解決後の読み込み完了まで読み込み中のまま維持する。
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // `items` が現在のスコープに対する全件か（ADR の R8）。安全側の false から始め、
  // 現在のスコープを描画・取得できた時点でのみ true にする。
  const [itemsComplete, setItemsComplete] = useState(false);

  const lastDocRef = useRef<FirestoreQueryDocSnapshot | null>(null);
  // 多重実行防止（onEndReached連打・refresh重複など）
  const inFlightRef = useRef(false);
  // 進行中に scope（日付範囲）変更などで来た再読込要求を、完了後にやり直すための予約。
  const pendingReloadRef = useRef<{
    forceServer?: boolean;
    refreshMarker?: boolean;
  } | null>(null);
  const refreshRef = useRef<
    | ((options?: {
        forceServer?: boolean;
        refreshMarker?: boolean;
      }) => Promise<void>)
    | null
  >(null);
  const readAll = !!options.readAll;
  // 検索実行時、または日付範囲指定時は全件取得してクライアント側フィルタの網羅性を保証する。
  // 通常の履歴表示は従来どおりページングし、初期表示の読み取り量を抑える。
  const fetchAll = shouldFetchAllTransactions({ range, readAll });
  const queryLimit = fetchAll ? null : TRANSACTIONS_PAGE_SIZE;
  const scopeKey = householdId
    ? buildPaginatedTransactionsScopeKey(householdId, range, fetchAll)
    : null;
  const fullHistoryScopeKey = householdId
    ? buildPaginatedTransactionsScopeKey(
        householdId,
        { from: null, to: null },
        true,
      )
    : null;

  const buildBaseQuery = useCallback((): FirestoreQuery | null => {
    if (!householdId) return null;
    let base: FirestoreQuery = householdCollection(householdId, "transactions");
    if (range.from) base = query(base, where("date", ">=", range.from));
    if (range.to) base = query(base, where("date", "<=", range.to));
    return query(base, orderBy("date", "desc"));
  }, [householdId, range.from, range.to]);

  const refresh = useCallback(
    async (options?: { forceServer?: boolean; refreshMarker?: boolean }) => {
      const base = buildBaseQuery();
      if (!base) {
        // householdId 未解決（起動直後）はまだ読み込みが確定していないため、
        // loadingInitial は倒さない。ここで false にすると空メッセージが
        // 一瞬表示される（Issue #9）。世帯なしユーザーはルートレイアウトが
        // /household へ遷移させるため、読み込み中のまま固着はしない。
        setItems([]);
        setHasMore(false);
        setItemsComplete(false);
        lastDocRef.current = null;
        return;
      }
      if (inFlightRef.current) {
        // ドロップせず、完了後に最新スコープで読み直すよう予約する
        // （ドリルダウン等で進行中に日付範囲が変わると新スコープが読まれず空のままになるため）。
        // 上書きではなくフラグをマージし、refreshMarker/forceServer の要求を取りこぼさない
        // （フォーカスのマーカー再読込が後続のスコープ変更要求に消されると、古いキャッシュを出してしまうため）。
        const prev = pendingReloadRef.current;
        pendingReloadRef.current = {
          forceServer: !!(prev?.forceServer || options?.forceServer),
          refreshMarker: !!(prev?.refreshMarker || options?.refreshMarker),
        };
        return;
      }
      inFlightRef.current = true;
      setLoadingInitial(true);
      // スコープが変わる場合、描画するまで `items` は前のスコープの配列である。
      // ここで倒さないと、日付範囲を変えた検索で「前の範囲の全件」を新しい範囲の
      // 合計として一瞬表示しうる（ADR の R8）。
      setItemsComplete(false);
      try {
        await loadScopeVersions();

        // ── Phase 1: 初回描画（ネットワークを使わない）─────────────────
        // 案B: マーカーのサーバー往復をこの後ろへ移し、手元にあるものを先に描く。
        // 以前はマーカー読みが先頭にあり、データが端末にあっても往復を待たされていた。
        //
        // 端末自身が書き込んだあとのエントリは、その書き込みを含まないため使わない
        // （ADR の R1）。捨てたあとはディスクキャッシュ読みが初回描画になる。
        const cachedEntry = scopeKey ? firstPageCache.get(scopeKey) : undefined;
        const cached =
          cachedEntry &&
          householdId &&
          isLocalWriteEpochCurrent(householdId, cachedEntry.epoch)
            ? cachedEntry
            : undefined;

        let painted: FirstPaintSource = pickFirstPaintSource({
          forceServer: !!options?.forceServer,
          hasUsableMemory: !!cached,
          cachedDocCount: 0,
        });
        // 描画に使ったページ。鮮度判定と差分読みの起点に使う。
        let paintedPage: CachedPage | null = null;
        // 件数比較用（ADR の R3）。**自スコープの stamp を使ったときだけ**意味を持つ。
        // 全期間スコープから版を借用した場合、件数はそのスコープのものなので比較できない。
        let stampedDocCount: number | undefined;
        let cachedDocCount: number | undefined;

        if (painted === "memory" && cached) {
          // 内容が同じなら前の配列を保持する。参照が変わらなければ再描画自体が
          // 起きず、スクロール位置の跳ねやタップ先のズレを避けられる（ADR の R4）。
          setItems((prev) =>
            areTransactionListsEquivalent(prev, cached.items)
              ? prev
              : cached.items,
          );
          lastDocRef.current = cached.lastDoc;
          setHasMore(cached.hasMore);
          paintedPage = cached;
        } else if (painted === "none" && !options?.forceServer) {
          const cacheSnap = await getQuerySnapshot(
            queryLimit == null ? base : query(base, limit(queryLimit)),
            "cache",
          );
          painted = pickFirstPaintSource({
            forceServer: false,
            hasUsableMemory: false,
            cachedDocCount: cacheSnap?.docs.length ?? 0,
          });
          if (painted === "cache" && cacheSnap) {
            // ディスクキャッシュの版は永続化した「最後にサーバー読みした時点の版」を使う。
            const ownVersion = scopeKey
              ? getPersistedScopeVersion(scopeKey)
              : null;
            // 自スコープの stamp が無いときだけ、全期間スコープの版を借りる。
            // 全期間を全件読みしていれば任意の部分期間もその読みに含まれるため健全。
            const borrowedVersion =
              !ownVersion && fetchAll && fullHistoryScopeKey
                ? getPersistedScopeVersion(fullHistoryScopeKey)
                : null;
            if (ownVersion && scopeKey) {
              // 件数は借用しない。借用元は上位集合であり、比較すると必ず下回る。
              stampedDocCount = getPersistedScopeDocCount(scopeKey);
              cachedDocCount = cacheSnap.docs.length;
            }
            const page: CachedPage = {
              items: mapActiveTransactions(cacheSnap.docs),
              version: ownVersion ?? borrowedVersion,
              lastDoc: cacheSnap.docs[cacheSnap.docs.length - 1] ?? null,
              hasMore: fetchAll
                ? false
                : cacheSnap.docs.length === TRANSACTIONS_PAGE_SIZE,
              epoch: householdId ? getLocalWriteEpoch(householdId) : 0,
            };
            if (scopeKey) firstPageCache.set(scopeKey, page);
            setItems((prev) =>
              areTransactionListsEquivalent(prev, page.items)
                ? prev
                : page.items,
            );
            lastDocRef.current = page.lastDoc;
            setHasMore(page.hasMore);
            paintedPage = page;
          }
        }

        // 描画できた時点で「まだ何も無い」状態を抜ける。ここで倒さないと、
        // 背景で再検証している間ずっと空メッセージと検索合計が隠れたままになる。
        if (paintedPage) {
          setLoadingInitial(false);
          // stamp が残っているスコープは、過去に全件サーバー読みされている。
          // `page` モードのスコープも stamp されるが（R6-b）、isReadComplete が
          // isFetchAllScope で弾くため、部分読みを完全と誤認しない。
          setItemsComplete(
            isReadComplete({
              isFetchAllScope: fetchAll,
              source: painted,
              scopeKnownComplete: paintedPage.version !== null,
            }),
          );
        }

        // ── Phase 2: 鮮度確認（ここで初めてネットワークを使う）───────────
        // すでに描画済みなので、この往復が遅くても初回表示は待たされない。
        let currentVersion = householdId
          ? currentVersionByHousehold.get(householdId)
          : undefined;
        if (
          householdId &&
          (options?.refreshMarker || currentVersion === undefined)
        ) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        }
        const comparableVersion = currentVersion ?? null;

        if (paintedPage) {
          const effectiveCurrentVersion = pickNewestDataVersion(
            comparableVersion,
            paintedPage.version,
          );
          if (
            !shouldReadServerForScope({
              hasCachedData: true,
              scopeVersion: paintedPage.version,
              currentDataVersion: effectiveCurrentVersion,
              stampedDocCount,
              cachedDocCount,
            })
          ) {
            return;
          }

          // ── Phase 3a: 差分読み ────────────────────────────────
          // 全期間の全件スコープに限り、変更分だけ取ってマージする。
          // メモリから描画した場合も版の意味は同じ（最後にサーバー読みした時点）
          // なので、同じ起点で差分を取れる。
          const incrementalSince = dataVersionToTimestamp(paintedPage.version);
          if (
            householdId &&
            fetchAll &&
            !range.from &&
            !range.to &&
            incrementalSince
          ) {
            const incrementalSnap = await getQuerySnapshot(
              query(
                householdCollection(householdId, "transactions"),
                where("updatedAt", ">", incrementalSince),
                orderBy("updatedAt", "asc"),
              ),
              "server",
            );
            const changedDocs = incrementalSnap?.docs ?? [];
            const deletedIds = new Set(
              changedDocs
                .filter((doc) => isDeletedTransactionData(doc.data()))
                .map((doc) => doc.id),
            );
            const nextItems = mergeTransactionCacheItems(
              paintedPage.items,
              mapActiveTransactions(changedDocs),
              deletedIds,
            );
            setItems((prev) =>
              areTransactionListsEquivalent(prev, nextItems) ? prev : nextItems,
            );
            lastDocRef.current = null;
            setHasMore(false);
            // 完全なキャッシュに、サーバーから取った変更分をマージした結果なので
            // 全件である（差分読みは fetchAll のスコープでしか走らない）。
            setItemsComplete(
              isReadComplete({
                isFetchAllScope: fetchAll,
                source: "server",
                scopeKnownComplete: true,
              }),
            );
            if (scopeKey) {
              firstPageCache.set(scopeKey, {
                items: nextItems,
                version: effectiveCurrentVersion,
                lastDoc: null,
                hasMore: false,
                epoch: householdId ? getLocalWriteEpoch(householdId) : 0,
              });
              // 差分読みでは生のDoc件数を再計算できない（changedDocs には既存Docの
              // 更新も混ざるため加算できず、items はソフトデリート除外後）。
              // 件数を未記録に戻し、次に全件サーバー読みが走るまで件数比較を止める。
              setPersistedScopeVersion(scopeKey, effectiveCurrentVersion);
            }
            return;
          }
        }

        // ── Phase 3b: サーバー読み ──────────────────────────────
        const snap = await getQuerySnapshot(
          queryLimit == null ? base : query(base, limit(queryLimit)),
          "server",
        );
        const docs = snap?.docs ?? [];
        const nextItems = mapActiveTransactions(docs);
        const nextHasMore = fetchAll
          ? false
          : docs.length === TRANSACTIONS_PAGE_SIZE;
        setItems((prev) =>
          areTransactionListsEquivalent(prev, nextItems) ? prev : nextItems,
        );
        // 全件サーバー読みの直後は、stamp の成否と無関係にこの配列は完全である。
        // マーカーが null の世帯（オフライン初回など）では setPersistedScopeVersion が
        // 記録をスキップするため、stamp を必要条件にすると合計が一度も出ない（R8）。
        setItemsComplete(
          isReadComplete({
            isFetchAllScope: fetchAll,
            source: "server",
            scopeKnownComplete: true,
          }),
        );
        lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
        setHasMore(nextHasMore);
        if (scopeKey) {
          firstPageCache.set(scopeKey, {
            items: nextItems,
            version: currentVersion ?? null,
            lastDoc: lastDocRef.current,
            hasMore: nextHasMore,
            epoch: householdId ? getLocalWriteEpoch(householdId) : 0,
          });
          // 生のDoc件数を併記する。次回のキャッシュ読みでこれを下回っていれば、
          // 書き込みが無いのに手元が減った＝退避されたと判定できる（ADR の R3）。
          setPersistedScopeVersion(scopeKey, currentVersion ?? null, docs.length);
        }
      } finally {
        setLoadingInitial(false);
        inFlightRef.current = false;
        const pending = pendingReloadRef.current;
        pendingReloadRef.current = null;
        if (pending) {
          // 最新の refresh（=最新スコープ）で読み直す
          void refreshRef.current?.(pending);
        }
      }
    },
    [
      buildBaseQuery,
      fetchAll,
      fullHistoryScopeKey,
      householdId,
      queryLimit,
      range.from,
      range.to,
      scopeKey,
    ],
  );
  refreshRef.current = refresh;

  const loadMore = useCallback(async () => {
    if (fetchAll) return; // 範囲一括取得時はページングしない
    if (inFlightRef.current || !hasMore) return;
    const base = buildBaseQuery();
    if (!base || !lastDocRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(
          base,
          startAfter(lastDocRef.current),
          limit(TRANSACTIONS_PAGE_SIZE),
        ),
      );
      setItems((prev) => {
        const seen = new Set(prev.map((tx) => tx.id));
        const next = mapActiveTransactions(snap.docs).filter(
          (tx) => !seen.has(tx.id),
        );
        return [...prev, ...next];
      });
      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMore(snap.docs.length === TRANSACTIONS_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
      inFlightRef.current = false;
    }
  }, [buildBaseQuery, fetchAll, hasMore]);

  // 世帯・日付範囲が変わったら先頭から読み直す
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 公開する関数は安定した参照にする（useFocusEffect 等の依存配列で
  // 毎レンダリング再生成されると無限リフレッシュになるため）。
  const loadMorePublic = useCallback(() => {
    void loadMore();
  }, [loadMore]);
  const refreshPublic = useCallback(() => {
    void refresh({ forceServer: true, refreshMarker: true });
  }, [refresh]);
  const refreshIfStalePublic = useCallback(() => {
    void refresh({ refreshMarker: true });
  }, [refresh]);

  return {
    items,
    loadingInitial,
    loadingMore,
    hasMore,
    itemsComplete,
    loadMore: loadMorePublic,
    refresh: refreshPublic,
    refreshIfStale: refreshIfStalePublic,
  };
}
