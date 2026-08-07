import type { TransactionType } from "./firestore";

type AccountSummaryTransaction = {
  date: string;
  amount: number;
  type: TransactionType;
  accountId?: string | null;
  accountName?: string;
};

export type MonthlyAccountSummary = {
  /**
   * 口座を束ねるキー。現存する口座は口座ID、口座が消えた記録は
   * `snapshot:<口座名>`。カテゴリ集計（`buildCategorySummaryKey`）と同じ考え方で、
   * IDが残っている限りは名前が変わっても1つにまとまる。
   */
  accountId: string;
  accountName: string;
  income: number;
  expense: number;
  /** 収入 - 支出。その月にその口座を通った増減。 */
  net: number;
};

const UNKNOWN_ACCOUNT_NAME = "口座なし";

function isInMonth(date: string, year: number, month: number): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}

function buildAccountSummaryKey(tx: AccountSummaryTransaction): string {
  if (tx.accountId) return tx.accountId;
  const snapshotName = tx.accountName?.trim();
  return snapshotName ? `snapshot:${snapshotName}` : "";
}

/**
 * 指定月の取引を口座ごとに集計する（Issue #11）。
 *
 * 口座名は取引のスナップショット（`accountName`）を使う。口座を消しても過去の
 * 集計が「口座なし」に化けないようにするためで、履歴表示と同じ方針。
 * 並びは「その月の動きが大きい口座」順（収入+支出の絶対量の降順）。
 */
export function buildMonthAccountSummaryFromTransactions(
  transactions: AccountSummaryTransaction[],
  year: number,
  month: number,
): MonthlyAccountSummary[] {
  const summaryMap = new Map<string, MonthlyAccountSummary>();

  for (const tx of transactions) {
    if (!isInMonth(tx.date, year, month)) continue;

    const accountId = buildAccountSummaryKey(tx);
    const existing = summaryMap.get(accountId);
    const summary = existing ?? {
      accountId,
      accountName: tx.accountName?.trim() || UNKNOWN_ACCOUNT_NAME,
      income: 0,
      expense: 0,
      net: 0,
    };

    if (tx.type === "income") {
      summary.income += tx.amount;
    } else {
      summary.expense += tx.amount;
    }
    summary.net = summary.income - summary.expense;

    if (!existing) summaryMap.set(accountId, summary);
  }

  return Array.from(summaryMap.values()).sort((a, b) => {
    const volumeDiff = b.income + b.expense - (a.income + a.expense);
    if (volumeDiff !== 0) return volumeDiff;
    return a.accountName.localeCompare(b.accountName, "ja-JP");
  });
}

export type AccountSummaryTotals = {
  income: number;
  expense: number;
  net: number;
};

export function buildAccountSummaryTotals(
  summaries: MonthlyAccountSummary[],
): AccountSummaryTotals {
  const totals = summaries.reduce(
    (acc, summary) => {
      acc.income += summary.income;
      acc.expense += summary.expense;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  return { ...totals, net: totals.income - totals.expense };
}
