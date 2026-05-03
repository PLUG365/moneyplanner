export type HistorySearchType = "income" | "expense";

export type HistorySearchCriteria = {
  type: HistorySearchType;
  categoryName?: string | null;
  breakdownName?: string | null;
  storeName?: string | null;
  memoQuery?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
};

export type HistorySearchConditionSummary = {
  count: number;
  label: string;
};

type SearchableTransaction = {
  date?: string | null;
  type: "income" | "expense";
  categoryName?: string | null;
  breakdownName?: string | null;
  storeName?: string | null;
  accountName?: string | null;
  memo?: string | null;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ja-JP");
}

function normalizeOptional(value?: string | null): string {
  return normalize(value ?? "");
}

export function filterHistoryTransactions<T extends SearchableTransaction>(
  transactions: T[],
  criteria: HistorySearchCriteria,
): T[] {
  const categoryName = normalizeOptional(criteria.categoryName);
  const breakdownName = normalizeOptional(criteria.breakdownName);
  const storeName = normalizeOptional(criteria.storeName);
  const memoQuery = normalizeOptional(criteria.memoQuery);
  const fromDate = criteria.fromDate?.trim() ?? "";
  const toDate = criteria.toDate?.trim() ?? "";

  return transactions.filter((transaction) => {
    if (transaction.type !== criteria.type) {
      return false;
    }

    if (fromDate && (!transaction.date || transaction.date < fromDate)) {
      return false;
    }

    if (toDate && (!transaction.date || transaction.date > toDate)) {
      return false;
    }

    if (
      categoryName &&
      normalizeOptional(transaction.categoryName) !== categoryName
    ) {
      return false;
    }

    if (
      breakdownName &&
      normalizeOptional(transaction.breakdownName) !== breakdownName
    ) {
      return false;
    }

    if (
      criteria.type === "expense" &&
      storeName &&
      normalizeOptional(transaction.storeName) !== storeName
    ) {
      return false;
    }

    if (memoQuery && !normalizeOptional(transaction.memo).includes(memoQuery)) {
      return false;
    }

    return true;
  });
}

export function buildHistorySearchConditionSummary(
  criteria: HistorySearchCriteria,
): HistorySearchConditionSummary {
  const parts: string[] = [];

  if (criteria.type === "income") {
    parts.push("収入");
  }
  if (criteria.categoryName?.trim()) {
    parts.push(criteria.categoryName.trim());
  }
  if (criteria.breakdownName?.trim()) {
    parts.push(criteria.breakdownName.trim());
  }
  if (criteria.type === "expense" && criteria.storeName?.trim()) {
    parts.push(criteria.storeName.trim());
  }
  if (criteria.memoQuery?.trim()) {
    parts.push(`メモ: ${criteria.memoQuery.trim()}`);
  }

  const fromDate = criteria.fromDate?.trim() ?? "";
  const toDate = criteria.toDate?.trim() ?? "";
  if (fromDate || toDate) {
    parts.push(`${fromDate || "未指定"}〜${toDate || "未指定"}`);
  }

  return {
    count: parts.length,
    label:
      criteria.type === "expense" && parts.length === 0
        ? "支出 / 条件なし"
        : parts.length > 0
          ? parts.join(" / ")
          : "条件なし",
  };
}
