import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import {
    householdCollection,
    mapTransaction,
    readHouseholdDataVersion,
    Transaction,
} from "@/lib/firestore";
import { DataVersion, shouldReadServerForScope } from "@/lib/readFreshness";

type CachedTransactionScope = {
  items: Transaction[];
  version: DataVersion;
  fromCache: boolean;
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
): FirebaseFirestoreTypes.Query {
  let query: FirebaseFirestoreTypes.Query = householdCollection(
    householdId,
    "transactions",
  )
    .where("date", ">=", range.from)
    .where("date", "<=", range.to);
  if (orderByDateDesc) {
    query = query.orderBy("date", "desc");
  }
  return query;
}

async function getTransactionSnapshot(
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

export function useCachedTransactions(
  householdId: string | null,
  options: UseCachedTransactionsOptions,
): {
  data: Transaction[];
  loading: boolean;
  error: Error | null;
  fromCache: boolean;
  refresh: () => void;
  refreshIfStale: () => void;
} {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const inFlightRef = useRef(false);
  const rangeFrom = options.range.from;
  const rangeTo = options.range.to;
  const orderByDateDesc = !!options.orderByDateDesc;
  const scopeKey = options.scopeKey;

  const load = useCallback(
    async (input?: { forceServer?: boolean; refreshMarker?: boolean }) => {
      if (!householdId) {
        setData([]);
        setLoading(false);
        setFromCache(false);
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const cacheKey = buildScopeCacheKey(householdId, scopeKey);
      const query = buildTransactionQuery(
        householdId,
        { from: rangeFrom, to: rangeTo },
        orderByDateDesc,
      );
      const memory = transactionScopeCache.get(cacheKey);

      if (!memory && !input?.forceServer) {
        setData([]);
        setFromCache(false);
      }

      try {
        let currentVersion = currentVersionByHousehold.get(householdId);
        if (input?.refreshMarker) {
          currentVersion = await readHouseholdDataVersion(
            householdId,
            "server",
          );
          currentVersionByHousehold.set(householdId, currentVersion);
        } else if (currentVersion === undefined) {
          currentVersion = await readHouseholdDataVersion(
            householdId,
            "server",
          );
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
            const cachedItems = cacheSnap.docs.map((doc) =>
              mapTransaction(doc.id, doc.data()),
            );
            const cachedVersion = currentVersion ?? memory?.version ?? null;
            transactionScopeCache.set(cacheKey, {
              items: cachedItems,
              version: cachedVersion,
              fromCache: true,
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
          serverSnap?.docs.map((doc) => mapTransaction(doc.id, doc.data())) ??
          [];
        const version = currentVersion ?? null;
        transactionScopeCache.set(cacheKey, {
          items: serverItems,
          version,
          fromCache: false,
        });
        setData(serverItems);
        setFromCache(false);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [householdId, orderByDateDesc, rangeFrom, rangeTo, scopeKey],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load({ forceServer: true, refreshMarker: true });
  }, [load]);

  const refreshIfStale = useCallback(() => {
    void load({ refreshMarker: true });
  }, [load]);

  return { data, loading, error, fromCache, refresh, refreshIfStale };
}
