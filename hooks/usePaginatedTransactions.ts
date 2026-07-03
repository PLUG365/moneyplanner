import {
    getDocs,
    getDocsFromCache,
    getDocsFromServer,
    limit,
    orderBy,
    query,
    startAfter,
    where,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapTransaction,
    readHouseholdDataVersionPreferServer,
    Transaction,
    type FirestoreQuery,
    type FirestoreQueryDocSnapshot,
    type FirestoreQuerySnapshot,
} from "@/lib/firestore";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";
import {
    getPersistedScopeVersion,
    loadScopeVersions,
    setPersistedScopeVersion,
} from "@/lib/scopeVersionStore";

export const TRANSACTIONS_PAGE_SIZE = 100;
// 日付範囲が指定されている時（ドリルダウン・期間検索）は、その範囲を一括取得して
// クライアント側フィルタ（カテゴリ等）が全件に効くようにする。範囲は有界なので安全。
// 念のため上限を設けて極端に広い範囲での過大読み取りを防ぐ。
export const RANGE_FETCH_LIMIT = 1000;

export type PaginatedTransactionsRange = {
  from: string | null;
  to: string | null;
};

export type PaginatedTransactions = {
  items: Transaction[];
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  refreshIfStale: () => void;
};

type CachedPage = {
  items: Transaction[];
  version: DataVersion;
  lastDoc: FirestoreQueryDocSnapshot | null;
  hasMore: boolean;
};

const firstPageCache = new Map<string, CachedPage>();
const currentVersionByHousehold = new Map<string, DataVersion>();

function buildScopeKey(
  householdId: string,
  range: PaginatedTransactionsRange,
): string {
  return `${householdId}:transactions:history:${range.from ?? ""}:${
    range.to ?? ""
  }`;
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
): PaginatedTransactions {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const lastDocRef =
    useRef<FirestoreQueryDocSnapshot | null>(null);
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
  const scopeKey = householdId ? buildScopeKey(householdId, range) : null;
  // 日付範囲指定時は一括取得（ページングしない）。範囲なし（全履歴）は従来どおりページング。
  const fetchAll = !!(range.from && range.to);
  const queryLimit = fetchAll ? RANGE_FETCH_LIMIT : TRANSACTIONS_PAGE_SIZE;

  const buildBaseQuery =
    useCallback((): FirestoreQuery | null => {
      if (!householdId) return null;
      let base: FirestoreQuery = householdCollection(
        householdId,
        "transactions",
      );
      if (range.from) base = query(base, where("date", ">=", range.from));
      if (range.to) base = query(base, where("date", "<=", range.to));
      return query(base, orderBy("date", "desc"));
    }, [householdId, range.from, range.to]);

  const refresh = useCallback(
    async (options?: { forceServer?: boolean; refreshMarker?: boolean }) => {
      const base = buildBaseQuery();
      if (!base) {
        setItems([]);
        setHasMore(false);
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
      try {
        await loadScopeVersions();
        let currentVersion = householdId
          ? currentVersionByHousehold.get(householdId)
          : undefined;
        if (householdId && options?.refreshMarker) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        } else if (householdId && currentVersion === undefined) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        }
        const comparableVersion = currentVersion ?? null;

        const cached = scopeKey ? firstPageCache.get(scopeKey) : undefined;
        if (cached && !options?.forceServer) {
          setItems(cached.items);
          lastDocRef.current = cached.lastDoc;
          setHasMore(cached.hasMore);
          if (
            !shouldReadServerForScope({
              hasCachedData: true,
              scopeVersion: cached.version,
              currentDataVersion: comparableVersion,
            })
          ) {
            return;
          }
        }

        if (!options?.forceServer) {
          const cacheSnap = await getQuerySnapshot(
            query(base, limit(queryLimit)),
            "cache",
          );
          if (cacheSnap && cacheSnap.docs.length > 0) {
            const cachedItems = cacheSnap.docs.map((doc) =>
              mapTransaction(doc.id, doc.data()),
            );
            const page: CachedPage = {
              items: cachedItems,
              // ディスクキャッシュの版は永続化した「最後にサーバー読みした時点の版」を使う（案B）。
              version: scopeKey ? getPersistedScopeVersion(scopeKey) : null,
              lastDoc:
                cacheSnap.docs.length > 0
                  ? cacheSnap.docs[cacheSnap.docs.length - 1]
                  : null,
              hasMore: fetchAll
                ? false
                : cacheSnap.docs.length === TRANSACTIONS_PAGE_SIZE,
            };
            if (scopeKey) firstPageCache.set(scopeKey, page);
            setItems(page.items);
            lastDocRef.current = page.lastDoc;
            setHasMore(page.hasMore);
            if (
              !shouldReadServerForScope({
                hasCachedData: true,
                scopeVersion: page.version,
                currentDataVersion: comparableVersion,
              })
            ) {
              return;
            }
          }
        }

        const snap = await getQuerySnapshot(
          query(base, limit(queryLimit)),
          "server",
        );
        const docs = snap?.docs ?? [];
        const nextItems = docs.map((doc) => mapTransaction(doc.id, doc.data()));
        const nextHasMore = fetchAll
          ? false
          : docs.length === TRANSACTIONS_PAGE_SIZE;
        setItems(nextItems);
        lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
        setHasMore(nextHasMore);
        if (scopeKey) {
          firstPageCache.set(scopeKey, {
            items: nextItems,
            version: currentVersion ?? null,
            lastDoc: lastDocRef.current,
            hasMore: nextHasMore,
          });
          setPersistedScopeVersion(scopeKey, currentVersion ?? null);
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
    [buildBaseQuery, fetchAll, householdId, queryLimit, scopeKey],
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
        const next = snap.docs
          .map((doc) => mapTransaction(doc.id, doc.data()))
          .filter((tx) => !seen.has(tx.id));
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
    loadMore: loadMorePublic,
    refresh: refreshPublic,
    refreshIfStale: refreshIfStalePublic,
  };
}
