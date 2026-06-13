import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import { householdCollection, mapTransaction, Transaction } from "@/lib/firestore";

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
};

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

  const refresh = useCallback(async () => {
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
      const snap = await base.limit(TRANSACTIONS_PAGE_SIZE).get();
      setItems(snap.docs.map((doc) => mapTransaction(doc.id, doc.data())));
      lastDocRef.current =
        snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      setHasMore(snap.docs.length === TRANSACTIONS_PAGE_SIZE);
    } finally {
      setLoadingInitial(false);
      inFlightRef.current = false;
    }
  }, [buildBaseQuery]);

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
    void refresh();
  }, [refresh]);

  return {
    items,
    loadingInitial,
    loadingMore,
    hasMore,
    loadMore: loadMorePublic,
    refresh: refreshPublic,
  };
}
