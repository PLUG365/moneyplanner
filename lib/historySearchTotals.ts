type TotalizableTransaction = {
  type: "income" | "expense";
  amount: number;
};

export type HistorySearchTotals = {
  count: number;
  income: number;
  expense: number;
  /** 収入 - 支出。収入と支出が混在するときだけ意味を持つ。 */
  net: number;
  hasIncome: boolean;
  hasExpense: boolean;
};

/**
 * 検索結果の合計金額を集計する。
 *
 * 検索条件が適用されているときは全件取得（usePaginatedTransactions の readAll）
 * されるため、ここで得られる合計は絞り込み結果の総額として正確になる。
 * 条件なしの履歴はページング読みで手元に一部しかないため、
 * 呼び出し側で合計を表示しないこと。
 */
export function buildHistorySearchTotals<T extends TotalizableTransaction>(
  transactions: T[],
): HistorySearchTotals {
  let income = 0;
  let expense = 0;
  let hasIncome = false;
  let hasExpense = false;

  for (const transaction of transactions) {
    // 金額の欠損・NaN は合計を壊すため 0 として扱う。
    const amount = Number.isFinite(transaction.amount) ? transaction.amount : 0;
    if (transaction.type === "income") {
      income += amount;
      hasIncome = true;
    } else {
      expense += amount;
      hasExpense = true;
    }
  }

  return {
    count: transactions.length,
    income,
    expense,
    net: income - expense,
    hasIncome,
    hasExpense,
  };
}
