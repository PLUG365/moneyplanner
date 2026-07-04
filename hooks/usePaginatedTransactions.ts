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
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";
import {
    getPersistedScopeVersion,
    loadScopeVersions,
    setPersistedScopeVersion,
} from "@/lib/scopeVersionStore";
import {
  buildPaginatedTransactionsScopeKey,
  pickNewestDataVersion,
  shouldFetchAllTransactions,
} from "@/lib/paginatedTransactionsMode";
import { mergeTransactionCacheItems } from "@/lib/transactionCacheMerge";
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
          const effectiveCurrentVersion = pickNewestDataVersion(
            comparableVersion,
            cached.version,
          );
          if (
            !shouldReadServerForScope({
              hasCachedData: true,
              scopeVersion: cached.version,
              currentDataVersion: effectiveCurrentVersion,
            })
          ) {
            return;
          }
        }

        if (!options?.forceServer) {
          const cacheSnap = await getQuerySnapshot(
            queryLimit == null ? base : query(base, limit(queryLimit)),
            "cache",
          );
          if (cacheSnap && cacheSnap.docs.length > 0) {
            const cachedItems = mapActiveTransactions(cacheSnap.docs);
            const page: CachedPage = {
              items: cachedItems,
              // ディスクキャッシュの版は永続化した「最後にサーバー読みした時点の版」を使う（案B）。
              version: scopeKey
                ? (getPersistedScopeVersion(scopeKey) ??
                  (fetchAll && fullHistoryScopeKey
                    ? getPersistedScopeVersion(fullHistoryScopeKey)
                    : null))
                : null,
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
            const effectiveCurrentVersion = pickNewestDataVersion(
              comparableVersion,
              page.version,
            );
            const shouldReadServer = shouldReadServerForScope({
              hasCachedData: true,
              scopeVersion: page.version,
              currentDataVersion: effectiveCurrentVersion,
            });
            if (!shouldReadServer) {
              return;
            }
            const incrementalSince = dataVersionToTimestamp(page.version);
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
                page.items,
                mapActiveTransactions(changedDocs),
                deletedIds,
              );
              setItems(nextItems);
              lastDocRef.current = null;
              setHasMore(false);
              if (scopeKey) {
                firstPageCache.set(scopeKey, {
                  items: nextItems,
                  version: effectiveCurrentVersion,
                  lastDoc: null,
                  hasMore: false,
                });
                setPersistedScopeVersion(scopeKey, effectiveCurrentVersion);
              }
              return;
            }
          }
        }

        const snap = await getQuerySnapshot(
          queryLimit == null ? base : query(base, limit(queryLimit)),
          "server",
        );
        const docs = snap?.docs ?? [];
        const nextItems = mapActiveTransactions(docs);
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
        const next = mapActiveTransactions(snap.docs)
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
