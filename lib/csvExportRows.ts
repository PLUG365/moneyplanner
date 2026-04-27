import type { CsvTransaction } from "./csvFormat";
import type { TransactionType } from "./firestore";

type CsvExportTransaction = {
  date: string;
  type: TransactionType;
  accountName?: string | null;
  categoryName?: string | null;
  breakdownName?: string | null;
  amount: number;
  memo?: string | null;
};

export function buildCsvRowsFromTransactions(
  transactions: CsvExportTransaction[],
): CsvTransaction[] {
  return transactions.map((transaction) => ({
    date: transaction.date,
    type: transaction.type,
    accountName: transaction.accountName ?? "",
    categoryName: transaction.categoryName ?? "",
    breakdownName: transaction.breakdownName ?? "",
    amount: transaction.amount,
    memo: transaction.memo ?? "",
  }));
}
