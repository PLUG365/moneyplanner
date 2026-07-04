export const HISTORY_SEARCH_STORE_OPTION_LIMIT = 40;

type StoreOptionTransaction = {
  type: "income" | "expense";
  categoryName?: string | null;
  storeName?: string | null;
};

type StoreOptionCriteria = {
  categoryName: string;
  storeQuery: string;
  limit?: number;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ja-JP");
}

export function buildHistorySearchStoreOptions(
  transactions: StoreOptionTransaction[],
  criteria: StoreOptionCriteria,
): string[] {
  const categoryName = criteria.categoryName.trim();
  const storeQuery = normalize(criteria.storeQuery);
  const limit = criteria.limit ?? HISTORY_SEARCH_STORE_OPTION_LIMIT;
  const seen = new Set<string>();
  const options: string[] = [];

  for (const tx of transactions) {
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
