import {
    getDocsFromCache,
    getDocsFromServer,
    orderBy,
    query,
    where,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapActiveTransactions,
    readHouseholdDataVersionPreferServer,
    Transaction,
    type FirestoreQuery,
    type FirestoreQuerySnapshot,
} from "@/lib/firestore";
import {
    getLocalWriteEpoch,
    isLocalWriteEpochCurrent,
} from "@/lib/localWriteEpoch";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";
import { areTransactionListsEquivalent } from "@/lib/transactionListIdentity";
import {
    pickFirstPaintSource,
    resolveHasSettled,
    type FirstPaintSource,
} from "@/lib/transactionReadPlan";
import {
    getPersistedScopeDocCount,
    getPersistedScopeVersion,
    loadScopeVersions,
    setPersistedScopeVersion,
} from "@/lib/scopeVersionStore";

type CachedTransactionScope = {
  items: Transaction[];
  version: DataVersion;
  fromCache: boolean;
  /** このエントリを作った時点の、端末自身の書き込みカウンタ（ADR の R1）。 */
  epoch: number;
};

type CachedTransactionsRange = {
  from: string;
  to: string;
};

type UseCachedTransactionsOptions = {
  scopeKey: string;
  range: CachedTransactionsRange;
  orderByDateDesc?: boolean;
};

const transactionScopeCache = new Map<string, CachedTransactionScope>();
const currentVersionByHousehold = new Map<string, DataVersion>();

function buildScopeCacheKey(householdId: string, scopeKey: string): string {
  return `${householdId}:transactions:${scopeKey}`;
}

function buildTransactionQuery(
  householdId: string,
  range: CachedTransactionsRange,
  orderByDateDesc: boolean,
): FirestoreQuery {
  let transactionsQuery: FirestoreQuery = query(
    householdCollection(householdId, "transactions"),
    where("date", ">=", range.from),
    where("date", "<=", range.to),
  );
  if (orderByDateDesc) {
    transactionsQuery = query(transactionsQuery, orderBy("date", "desc"));
  }
  return transactionsQuery;
}

async function getTransactionSnapshot(
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

export function useCachedTransactions(
  householdId: string | null,
  options: UseCachedTransactionsOptions,
): {
  data: Transaction[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  /** このスコープの読み込みが一巡したか。空メッセージの表示可否に使う。 */
  hasSettled: boolean;
  refresh: () => void;
  refreshIfStale: () => void;
} {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  // このスコープの読み込みが一巡したか。`loading` はサーバー読みの間だけ true に
  // なる（= ProgressOverlay 用）ので、その手前の版チェック・キャッシュ読みの間は
  // 「data 空 かつ 非ローディング」になり、呼び出し側が0件と誤判定する（Issue #9）。
  // 空メッセージの表示可否はこちらで判定する。
  const [hasSettled, setHasSettled] = useState(false);
  // 現在 `data` に入っている内容が、どのスコープのものか。スコープ切替の判定に使う。
  const paintedScopeRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  // 進行中に scope（年・日付範囲）変更などで来た再読込要求を、完了後にやり直すための予約。
  const pendingReloadRef = useRef<{
    forceServer?: boolean;
    refreshMarker?: boolean;
  } | null>(null);
  const loadRef = useRef<
    | ((input?: {
        forceServer?: boolean;
        refreshMarker?: boolean;
      }) => Promise<void>)
    | null
  >(null);
  const rangeFrom = options.range.from;
  const rangeTo = options.range.to;
  const orderByDateDesc = !!options.orderByDateDesc;
  const scopeKey = options.scopeKey;

  const load = useCallback(
    async (input?: { forceServer?: boolean; refreshMarker?: boolean }) => {
      if (!householdId) {
        // ここでは hasSettled を倒さない（false のまま維持する）。倒すと世帯ID未解決の間に
        // 空メッセージが出てしまうため。世帯なしユーザーはルートレイアウトが /household へ
        // 遷移させるので、通常この状態でタブが表示され続けることはない。
        // ただし万一 householdId が解決しないままだと、集計タブはデータも空メッセージも
        // 出さない無表示状態になる（loading は false のためオーバーレイも消える）。
        setData([]);
        setLoading(false);
        setFromCache(false);
        return;
      }
      if (inFlightRef.current) {
        // ドロップせず、完了後に最新スコープで読み直すよう予約する。
        // 上書きではなくフラグをマージし、refreshMarker/forceServer の要求を取りこぼさない。
        const prev = pendingReloadRef.current;
        pendingReloadRef.current = {
          forceServer: !!(prev?.forceServer || input?.forceServer),
          refreshMarker: !!(prev?.refreshMarker || input?.refreshMarker),
        };
        return;
      }
      inFlightRef.current = true;
      // 年切替などでスコープが変わるときも、新スコープの読み込みが終わるまでは
      // 0件と確定させない（下で setData([]) するため、ここで倒さないと
      // 切替直後に空メッセージが出る）。
      setHasSettled(false);
      await loadScopeVersions();

      const cacheKey = buildScopeCacheKey(householdId, scopeKey);
      const query = buildTransactionQuery(
        householdId,
        { from: rangeFrom, to: rangeTo },
        orderByDateDesc,
      );
      // 端末自身が書き込んだあとのエントリは、その書き込みを含まないため使わない。
      // 捨てたあとはディスクキャッシュ読みが初回描画になり、そちらは未送信の
      // 書き込みも含むので、自分の記録が反映された状態で描画される（ADR の R1）。
      const memoryEntry = transactionScopeCache.get(cacheKey);
      const memory =
        memoryEntry && isLocalWriteEpochCurrent(householdId, memoryEntry.epoch)
          ? memoryEntry
          : undefined;

      // スコープ（年・日付範囲）が変わったときだけ空にする。前のスコープのデータを
      // 新しいスコープの内容として見せないための処理である。
      //
      // 「メモリキャッシュが使えないとき」を条件にしてはいけない。端末自身の書き込み後は
      // R1 により memory を捨てるため、記録直後に集計タブへ移ると画面がいったん空に
      // なってしまう。同じスコープなら、画面に出ている内容をディスク読みが返るまで
      // 保持したほうがよい（ディスク読みはローカルなので待ち時間は短い）。
      if (paintedScopeRef.current !== cacheKey && !input?.forceServer) {
        setData([]);
        setFromCache(false);
      }

      // 何を描画できたか。catch 側でも参照するため try の外で宣言する。
      let painted: FirstPaintSource = pickFirstPaintSource({
        forceServer: !!input?.forceServer,
        hasUsableMemory: !!memory,
        cachedDocCount: 0,
      });

      try {
        // ── Phase 1: 初回描画（ネットワークを使わない）─────────────────
        // 案B: マーカーのサーバー往復をこの後ろへ移し、手元にあるものを先に描く。
        // 以前はマーカー読みが先頭にあり、データが端末にあっても往復を待たされていた。
        //
        // 描画に使った配列が「いつ時点のサーバー読みか」。鮮度判定に使う。
        let paintedVersion: DataVersion = null;
        // 件数比較用（ADR の R3）。ディスクキャッシュから描いたときだけ意味を持つ。
        let stampedDocCount: number | undefined;
        let cachedDocCount: number | undefined;

        if (painted === "memory" && memory) {
          // 内容が同じなら前の配列を保持する。参照が変わらなければ再描画自体が
          // 起きず、スクロール位置の跳ねやタップ先のズレを避けられる（ADR の R4）。
          setData((prev) =>
            areTransactionListsEquivalent(prev, memory.items)
              ? prev
              : memory.items,
          );
          setFromCache(memory.fromCache);
          paintedScopeRef.current = cacheKey;
          paintedVersion = memory.version;
        } else if (painted === "none" && !input?.forceServer) {
          const cacheSnap = await getTransactionSnapshot(query, "cache");
          painted = pickFirstPaintSource({
            forceServer: false,
            hasUsableMemory: false,
            cachedDocCount: cacheSnap?.docs.length ?? 0,
          });
          if (painted === "cache" && cacheSnap) {
            const cachedItems = mapActiveTransactions(cacheSnap.docs);
            // ディスクキャッシュの版は「現在版」ではなく、永続化した
            // 「このスコープを最後にサーバー読みした時点の版」を使う。
            paintedVersion = getPersistedScopeVersion(cacheKey);
            // 比較はソフトデリート除外前の生の件数で行う（ADR の R3）。
            stampedDocCount = getPersistedScopeDocCount(cacheKey);
            cachedDocCount = cacheSnap.docs.length;
            transactionScopeCache.set(cacheKey, {
              items: cachedItems,
              version: paintedVersion,
              fromCache: true,
              epoch: getLocalWriteEpoch(householdId),
            });
            setData((prev) =>
              areTransactionListsEquivalent(prev, cachedItems)
                ? prev
                : cachedItems,
            );
            setFromCache(true);
            paintedScopeRef.current = cacheKey;
          }
        }

        // 描画できたかで「0件と確定してよいか」が決まる。ディスクキャッシュ0件では
        // 「世帯が空」と「未キャッシュ」を区別できないため、サーバー読みを待つ。
        setHasSettled(
          resolveHasSettled({ paintedSource: painted, serverReadDone: false }),
        );

        // ── Phase 2: 鮮度確認（ここで初めてネットワークを使う）───────────
        // すでに描画済みなので、この往復が遅くても初回表示は待たされない。
        let currentVersion = currentVersionByHousehold.get(householdId);
        if (input?.refreshMarker || currentVersion === undefined) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        }

        if (
          painted !== "none" &&
          !shouldReadServerForScope({
            hasCachedData: true,
            scopeVersion: paintedVersion,
            currentDataVersion: currentVersion,
            stampedDocCount,
            cachedDocCount,
          })
        ) {
          setError(null);
          return;
        }

        // ── Phase 3: サーバー読み ────────────────────────────────
        // メモリから描いたが版が古かった場合、ディスクキャッシュも同じ版なので
        // 読み直さずサーバーへ行く（メモリの版は最後のサーバー読みの stamp と一致する）。
        //
        // オーバーレイは「描けるものが何も無かったとき」だけ出す。描画済みの上に
        // かぶせると、背景での再検証のたびに画面が覆われる（ADR の R2）。
        // 描画済みの間は fromCache が true のままなので、呼び出し側はそれを
        // 「更新中」の手がかりに使える。
        if (painted === "none") setLoading(true);
        const serverSnap = await getTransactionSnapshot(query, "server");
        const serverItems =
          mapActiveTransactions(serverSnap?.docs ?? []);
        const version = currentVersion ?? null;
        transactionScopeCache.set(cacheKey, {
          items: serverItems,
          version,
          fromCache: false,
          epoch: getLocalWriteEpoch(householdId),
        });
        // 生のDoc件数を併記する。次回のキャッシュ読みでこれを下回っていれば、
        // 書き込みが無いのに手元が減った＝退避されたと判定できる（ADR の R3）。
        setPersistedScopeVersion(cacheKey, version, serverSnap?.docs.length);
        setData((prev) =>
          areTransactionListsEquivalent(prev, serverItems) ? prev : serverItems,
        );
        setFromCache(false);
        paintedScopeRef.current = cacheKey;
        setError(null);
      } catch (err) {
        // 何も描けていないときだけエラーを伝える。キャッシュから描画できている
        // 場合、背景の再検証が失敗しても画面をエラーへ切り替えない（ADR の R5）。
        // 更新できていないことは fromCache が true のままであることで表す。
        if (painted === "none") setError(err as Error);
      } finally {
        setLoading(false);
        setHasSettled(true);
        inFlightRef.current = false;
        const pending = pendingReloadRef.current;
        pendingReloadRef.current = null;
        if (pending) {
          // 最新の load（=最新スコープ）で読み直す
          void loadRef.current?.(pending);
        }
      }
    },
    [householdId, orderByDateDesc, rangeFrom, rangeTo, scopeKey],
  );
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load({ forceServer: true, refreshMarker: true });
  }, [load]);

  const refreshIfStale = useCallback(() => {
    void load({ refreshMarker: true });
  }, [load]);

  return { data, loading, error, fromCache, hasSettled, refresh, refreshIfStale };
}
