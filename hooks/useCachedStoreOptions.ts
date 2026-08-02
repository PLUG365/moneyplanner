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
 */
const STORE_SOURCE_WINDOW_MONTHS = 12;

/**
 * 期間内の取引がこの件数に満たなければ、期間の制限をやめて全期間から作り直す。
 *
 * 期間を切るのは**読み取りが重い世帯を守るため**であって、記録の少ない世帯には
 * 意味がない。全期間を読んでも安いのに候補だけ減らしてしまうと、得るものが無く
 * 使い勝手だけ落ちる。読み取りのコストは返す件数にほぼ比例するので、
 * 期間内が少なければ全期間を読んでも軽い。
 *
 * この件数を上回る世帯では期間制限が効き、12ヶ月より前にしか使っていないお店は
 * 候補に出なくなる。手入力は従来どおりできるため、影響は候補の並びに限られる。
 */
const STORE_SOURCE_WIDEN_THRESHOLD = 300;

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
    const base = householdCollection(householdId, "transactions");
    let snapshot = await getDocsFromCache(
      query(
        base,
        where(
          "date",
          ">=",
          monthsAgoDateString(new Date(), STORE_SOURCE_WINDOW_MONTHS),
        ),
        orderBy("date", "desc"),
      ),
    );
    // 期間内が少ない世帯では、期間を切っても速くならず候補が減るだけなので
    // 全期間から作り直す。返す件数が少なければ全期間読みも軽い。
    if (snapshot.docs.length < STORE_SOURCE_WIDEN_THRESHOLD) {
      snapshot = await getDocsFromCache(query(base, orderBy("date", "desc")));
    }
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
