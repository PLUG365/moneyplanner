type DatedTransaction = {
  date?: string | null;
};

/**
 * 履歴一覧に出す日付の上限（`YYYY-MM-DD`）を決める。`null` は上限なし。
 *
 * 先日付で登録した予定（給料日・引き落とし日など）が初期表示の先頭に並び続けると、
 * 直近の記録が見えなくなるため、既定では当日までに絞る（Issue #13）。
 *
 * 検索で終了日を明示指定しているときは上限を足さない。ユーザーが期間を指定した
 * 意図の方が優先で、指定した範囲を出しているのに空になる方が分かりにくいため。
 */
export function resolveHistoryDateCutoff(input: {
  showFutureTransactions: boolean;
  toDate?: string | null;
  today: string;
}): string | null {
  if (input.showFutureTransactions) return null;
  if (input.toDate?.trim()) return null;
  return input.today;
}

/**
 * 上限日以前の記録だけを残す。日付を持たない記録は、日付範囲の絞り込みと同じく
 * （`filterHistoryTransactions`）範囲外として落とす。
 */
export function filterTransactionsUpToDate<T extends DatedTransaction>(
  transactions: T[],
  cutoff: string | null,
): T[] {
  if (!cutoff) return transactions;
  return transactions.filter((tx) => !!tx.date && tx.date <= cutoff);
}
