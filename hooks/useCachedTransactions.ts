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
import {
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

      if (!memory && !input?.forceServer) {
        setData([]);
        setFromCache(false);
      }

      try {
        let currentVersion = currentVersionByHousehold.get(householdId);
        if (input?.refreshMarker) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        } else if (currentVersion === undefined) {
          currentVersion =
            await readHouseholdDataVersionPreferServer(householdId);
          currentVersionByHousehold.set(householdId, currentVersion);
        }

        if (memory && !input?.forceServer) {
          setData(memory.items);
          setFromCache(memory.fromCache);
          if (
            !shouldReadServerForScope({
              hasCachedData: true,
              scopeVersion: memory.version,
              currentDataVersion: currentVersion,
            })
          ) {
            setError(null);
            return;
          }
        }

        if (!input?.forceServer) {
          const cacheSnap = await getTransactionSnapshot(query, "cache");
          if (cacheSnap && cacheSnap.docs.length > 0) {
            const cachedItems = mapActiveTransactions(cacheSnap.docs);
            // ディスクキャッシュの版は「現在版」ではなく、永続化した
            // 「このスコープを最後にサーバー読みした時点の版」を使う（案B）。
            const cachedVersion = getPersistedScopeVersion(cacheKey);
            transactionScopeCache.set(cacheKey, {
              items: cachedItems,
              version: cachedVersion,
              fromCache: true,
              epoch: getLocalWriteEpoch(householdId),
            });
            setData(cachedItems);
            setFromCache(true);
            if (
              !shouldReadServerForScope({
                hasCachedData: true,
                scopeVersion: cachedVersion,
                currentDataVersion: currentVersion,
              })
            ) {
              setError(null);
              return;
            }
          }
        }

        setLoading(true);
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
        setPersistedScopeVersion(cacheKey, version);
        setData(serverItems);
        setFromCache(false);
        setError(null);
      } catch (err) {
        setError(err as Error);
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
