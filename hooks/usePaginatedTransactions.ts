import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapTransaction,
    readHouseholdDataVersion,
    Transaction,
} from "@/lib/firestore";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";

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

type CachedPage = {
  items: Transaction[];
  version: DataVersion;
  lastDoc: FirebaseFirestoreTypes.QueryDocumentSnapshot | null;
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
  query: FirebaseFirestoreTypes.Query,
  source: "cache" | "server",
): Promise<FirebaseFirestoreTypes.QuerySnapshot | null> {
  try {
    return await query.get({ source });
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
    useRef<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);
  // 多重実行防止（onEndReached連打・refresh重複など）
  const inFlightRef = useRef(false);
  const scopeKey = householdId ? buildScopeKey(householdId, range) : null;

  const buildBaseQuery =
    useCallback((): FirebaseFirestoreTypes.Query | null => {
      if (!householdId) return null;
      let query: FirebaseFirestoreTypes.Query = householdCollection(
        householdId,
        "transactions",
      );
      if (range.from) query = query.where("date", ">=", range.from);
      if (range.to) query = query.where("date", "<=", range.to);
      return query.orderBy("date", "desc");
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
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoadingInitial(true);
      try {
        let currentVersion = householdId
          ? currentVersionByHousehold.get(householdId)
          : undefined;
        if (householdId && options?.refreshMarker) {
          currentVersion = await readHouseholdDataVersion(
            householdId,
            "server",
          );
          currentVersionByHousehold.set(householdId, currentVersion);
        } else if (householdId && currentVersion === undefined) {
          currentVersion = await readHouseholdDataVersion(
            householdId,
            "server",
          );
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
            base.limit(TRANSACTIONS_PAGE_SIZE),
            "cache",
          );
          if (cacheSnap && cacheSnap.docs.length > 0) {
            const cachedItems = cacheSnap.docs.map((doc) =>
              mapTransaction(doc.id, doc.data()),
            );
            const page: CachedPage = {
              items: cachedItems,
              version: currentVersion ?? cached?.version ?? null,
              lastDoc:
                cacheSnap.docs.length > 0
                  ? cacheSnap.docs[cacheSnap.docs.length - 1]
                  : null,
              hasMore: cacheSnap.docs.length === TRANSACTIONS_PAGE_SIZE,
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
          base.limit(TRANSACTIONS_PAGE_SIZE),
          "server",
        );
        const docs = snap?.docs ?? [];
        const nextItems = docs.map((doc) => mapTransaction(doc.id, doc.data()));
        setItems(nextItems);
        lastDocRef.current = docs.length > 0 ? docs[docs.length - 1] : null;
        setHasMore(docs.length === TRANSACTIONS_PAGE_SIZE);
        if (scopeKey) {
          firstPageCache.set(scopeKey, {
            items: nextItems,
            version: currentVersion ?? null,
            lastDoc: lastDocRef.current,
            hasMore: docs.length === TRANSACTIONS_PAGE_SIZE,
          });
        }
      } finally {
        setLoadingInitial(false);
        inFlightRef.current = false;
      }
    },
    [buildBaseQuery, householdId, scopeKey],
  );

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore) return;
    const base = buildBaseQuery();
    if (!base || !lastDocRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const snap = await base
        .startAfter(lastDocRef.current)
        .limit(TRANSACTIONS_PAGE_SIZE)
        .get();
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
  }, [buildBaseQuery, hasMore]);

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
