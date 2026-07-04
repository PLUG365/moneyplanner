import type { HistorySearchType } from "./historySearch";

export const HISTORY_SEARCH_STORE_OPTION_LIMIT = 40;

type SearchOptionTransaction = {
  type: "income" | "expense";
  categoryName?: string | null;
  breakdownName?: string | null;
  storeName?: string | null;
};

type BreakdownOptionCriteria = {
  type: HistorySearchType;
  categoryName: string;
};

type StoreOptionCriteria = {
  categoryName: string;
  storeQuery: string;
  limit?: number;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ja-JP");
}

function matchesType(
  transaction: SearchOptionTransaction,
  type: HistorySearchType,
): boolean {
  return type === "all" || transaction.type === type;
}

function pushUniqueNonEmpty(
  options: string[],
  seen: Set<string>,
  value?: string | null,
): void {
  const trimmed = value?.trim();
  if (!trimmed || seen.has(trimmed)) return;

  seen.add(trimmed);
  options.push(trimmed);
}

export function buildHistorySearchCategoryOptions(
  transactions: SearchOptionTransaction[],
  type: HistorySearchType,
  candidateTransactions: SearchOptionTransaction[] = transactions,
): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const tx of candidateTransactions) {
    if (!matchesType(tx, type)) continue;
    pushUniqueNonEmpty(options, seen, tx.categoryName);
  }

  return options;
}

export function buildHistorySearchBreakdownOptions(
  transactions: SearchOptionTransaction[],
  criteria: BreakdownOptionCriteria,
  candidateTransactions: SearchOptionTransaction[] = transactions,
): string[] {
  const categoryName = criteria.categoryName.trim();
  const seen = new Set<string>();
  const options: string[] = [];

  for (const tx of candidateTransactions) {
    if (!matchesType(tx, criteria.type)) continue;
    if (categoryName && tx.categoryName !== categoryName) continue;
    pushUniqueNonEmpty(options, seen, tx.breakdownName);
  }

  return options;
}

export function buildHistorySearchStoreOptions(
  transactions: SearchOptionTransaction[],
  criteria: StoreOptionCriteria,
  candidateTransactions: SearchOptionTransaction[] = transactions,
): string[] {
  const categoryName = criteria.categoryName.trim();
  const storeQuery = normalize(criteria.storeQuery);
  const limit = criteria.limit ?? HISTORY_SEARCH_STORE_OPTION_LIMIT;
  const seen = new Set<string>();
  const options: string[] = [];

  for (const tx of candidateTransactions) {
    if (tx.type !== "expense") continue;
    if (categoryName && tx.categoryName !== categoryName) continue;

    const storeName = tx.storeName?.trim();
    if (!storeName) continue;
    if (storeQuery && !normalize(storeName).includes(storeQuery)) continue;
    if (seen.has(storeName)) continue;

    seen.add(storeName);
    options.push(storeName);
    if (options.length >= limit) break;
  }

  return options;
}
