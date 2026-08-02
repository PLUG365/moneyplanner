import {
    getDocsFromCache,
    orderBy,
    query,
    where,
} from "@react-native-firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    householdCollection,
    mapActiveTransactions,
    type Transaction,
} from "@/lib/firestore";
import { getLocalWriteEpoch } from "@/lib/localWriteEpoch";
import { monthsAgoDateString } from "@/lib/paginatedTransactionsMode";
import {
    buildStoreOptionsFromTransactions,
    type StorePickerOption,
} from "@/lib/storeOptions";

/**
 * お店候補の元にする取引の期間（月数）。
 *
 * 候補は「最近このカテゴリで使ったお店」を出すためのものなので、全期間を読む
 * 必要はない。取引が1万件規模になると全件読みだけで約3秒かかり、記録タブでは
 * 金額入力モーダルの操作が止まるほどJSスレッドが占有されていた。
 *
 * 代償として、この期間より前にしか使っていないお店は候補に出なくなる。
 * 手入力は従来どおりできるため、実害は候補の並びに限られる。
 */
const STORE_SOURCE_WINDOW_MONTHS = 12;

type StoreSourceCache = {
  householdId: string;
  epoch: number;
  transactions: Transaction[];
};

/**
 * 取得結果をモジュール内で共有する。
 *
 * このフックは記録タブと履歴タブの両方で使われ、さらにマウント時・フォーカス時・
 * 一覧件数の変化時にそれぞれ再取得していたため、**起動直後に同じ全件読みが5本
 * 同時に発行**されていた。Firestore は直列に処理するため、そのまま待ち時間が
 * 積み上がっていた。
 *
 * 端末自身の書き込み（`lib/localWriteEpoch.ts`）があれば作り直す。
 */
let sourceCache: StoreSourceCache | null = null;
let inFlight: { householdId: string; promise: Promise<Transaction[]> } | null =
  null;

async function loadStoreSourceTransactions(
  householdId: string,
): Promise<Transaction[]> {
  const epoch = getLocalWriteEpoch(householdId);
  if (
    sourceCache &&
    sourceCache.householdId === householdId &&
    sourceCache.epoch === epoch
  ) {
    return sourceCache.transactions;
  }
  if (inFlight && inFlight.householdId === householdId) {
    return inFlight.promise;
  }

  const promise = (async () => {
    const snapshot = await getDocsFromCache(
      query(
        householdCollection(householdId, "transactions"),
        where(
          "date",
          ">=",
          monthsAgoDateString(new Date(), STORE_SOURCE_WINDOW_MONTHS),
        ),
        orderBy("date", "desc"),
      ),
    );
    const mapped = mapActiveTransactions(snapshot.docs);
    // 取得開始時点の epoch で記録する。読み込み中に書き込みがあれば
    // 次回は不一致となり読み直される。
    sourceCache = { householdId, epoch, transactions: mapped };
    return mapped;
  })().finally(() => {
    inFlight = null;
  });

  inFlight = { householdId, promise };
  return promise;
}

/** サインアウト・世帯切替時に呼ぶ。 */
export function clearStoreSourceCache(): void {
  sourceCache = null;
  inFlight = null;
}

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

    void loadStoreSourceTransactions(householdId)
      .then((loaded) => {
        setTransactions(loaded);
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
