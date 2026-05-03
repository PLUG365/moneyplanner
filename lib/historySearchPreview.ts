import type { HistorySearchType } from "./historySearch";

export type HistorySearchPreviewTransaction = {
  id: string;
  date: string;
  type: HistorySearchType;
  amount: number;
  categoryName: string;
  breakdownName: string;
  storeName: string;
  accountName: string;
  memo: string;
  categoryColor: string;
};

export type HistorySearchPreviewOptions = {
  categoryOptions: string[];
  breakdownOptions: string[];
  storeOptions: string[];
};

export const historySearchPreviewTransactions: HistorySearchPreviewTransaction[] =
  [
    {
      id: "preview-expense-1",
      date: "2026-05-03",
      type: "expense",
      amount: 4280,
      categoryName: "食費",
      breakdownName: "スーパー",
      storeName: "駅前スーパー",
      accountName: "共有財布",
      memo: "週末のまとめ買い",
      categoryColor: "#C62828",
    },
    {
      id: "preview-expense-2",
      date: "2026-05-02",
      type: "expense",
      amount: 1860,
      categoryName: "食費",
      breakdownName: "外食",
      storeName: "定食屋あおば",
      accountName: "共有財布",
      memo: "ランチ",
      categoryColor: "#C62828",
    },
    {
      id: "preview-expense-3",
      date: "2026-04-29",
      type: "expense",
      amount: 2200,
      categoryName: "日用品",
      breakdownName: "消耗品",
      storeName: "駅前スーパー",
      accountName: "クレジットカード",
      memo: "洗剤とティッシュ",
      categoryColor: "#00796B",
    },
    {
      id: "preview-expense-4",
      date: "2026-04-25",
      type: "expense",
      amount: 720,
      categoryName: "交通",
      breakdownName: "電車",
      storeName: "",
      accountName: "交通系IC",
      memo: "通院",
      categoryColor: "#1565C0",
    },
    {
      id: "preview-income-1",
      date: "2026-04-25",
      type: "income",
      amount: 320000,
      categoryName: "給与",
      breakdownName: "本業",
      storeName: "",
      accountName: "銀行口座",
      memo: "4月分給与",
      categoryColor: "#1565C0",
    },
    {
      id: "preview-income-2",
      date: "2026-04-18",
      type: "income",
      amount: 12000,
      categoryName: "臨時収入",
      breakdownName: "",
      storeName: "",
      accountName: "銀行口座",
      memo: "立替精算",
      categoryColor: "#2E7D32",
    },
  ];

function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

export function buildHistorySearchPreviewOptions(
  transactions: HistorySearchPreviewTransaction[],
  type: HistorySearchType,
  categoryName: string,
): HistorySearchPreviewOptions {
  const typedTransactions = transactions.filter((tx) => tx.type === type);
  const categoryScopedTransactions = typedTransactions.filter(
    (tx) => !categoryName || tx.categoryName === categoryName,
  );

  return {
    categoryOptions: uniqueNonEmpty(
      typedTransactions.map((tx) => tx.categoryName),
    ),
    breakdownOptions: uniqueNonEmpty(
      categoryScopedTransactions.map((tx) => tx.breakdownName),
    ),
    storeOptions:
      type === "expense"
        ? uniqueNonEmpty(categoryScopedTransactions.map((tx) => tx.storeName))
        : [],
  };
}
