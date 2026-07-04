import {
    getDocsFromCache,
    orderBy,
    query,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    householdCollection,
    mapActiveTransactions,
    type Transaction,
} from "@/lib/firestore";
import {
    buildStoreOptionsFromTransactions,
    type StorePickerOption,
} from "@/lib/storeOptions";

export function useCachedStoreOptions(
  householdId: string | null,
  categoryName: string,
): {
  storeOptions: StorePickerOption[];
  transactions: Transaction[];
  refresh: () => void;
} {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refresh = useCallback(() => {
    if (!householdId) {
      setTransactions([]);
      return;
    }

    void getDocsFromCache(
      query(
        householdCollection(householdId, "transactions"),
        orderBy("date", "desc"),
      ),
    )
      .then((snapshot) => {
        setTransactions(mapActiveTransactions(snapshot.docs));
      })
      .catch(() => {
        setTransactions([]);
      });
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const storeOptions = useMemo(
    () => buildStoreOptionsFromTransactions(transactions, categoryName),
    [categoryName, transactions],
  );

  return { storeOptions, transactions, refresh };
}
