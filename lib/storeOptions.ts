type StoreOption = {
  id: string;
  name: string;
  categoryId: string | null;
  lastUsedAt: string;
};

type StoreCategoryUsage = {
  storeId: string;
  categoryId: string;
  lastUsedAt: string;
};

type TransactionStoreSource = {
  type?: "income" | "expense";
  date: string;
  createdAt: string;
  categoryName?: string | null;
  storeName?: string | null;
};

export type StorePickerOption = {
  id: string | null;
  name: string;
  lastUsedDate: string;
};

export const STORE_PICKER_OPTION_LIMIT = 40;

function normalizeStoreName(name: string): string {
  return name.trim().toLowerCase();
}

export function findStoreByName<T extends StoreOption>(
  name: string,
  stores: T[],
): T | null {
  const key = normalizeStoreName(name);
  if (!key) return null;

  return stores.find((store) => normalizeStoreName(store.name) === key) ?? null;
}

export function buildVisibleStorePickerOptions<T extends { name: string }>(
  stores: T[],
  searchQuery: string,
  limit = STORE_PICKER_OPTION_LIMIT,
): T[] {
  const query = normalizeStoreName(searchQuery);
  const options: T[] = [];

  for (const store of stores) {
    const name = store.name.trim();
    if (!name) continue;
    if (query && !normalizeStoreName(name).includes(query)) continue;

    options.push(store);
    if (options.length >= limit) break;
  }

  return options;
}

function compareStoreRecency(
  leftDate: string,
  leftCreatedAt: string,
  rightDate: string,
  rightCreatedAt: string,
): number {
  const dateCmp = rightDate.localeCompare(leftDate);
  if (dateCmp !== 0) return dateCmp;
  return rightCreatedAt.localeCompare(leftCreatedAt);
}

export function buildStoreOptionsFromTransactions(
  transactions: TransactionStoreSource[],
  selectedCategoryName = "",
): StorePickerOption[] {
  const categoryName = selectedCategoryName.trim();
  const storesByName = new Map<
    string,
    {
      name: string;
      latestDate: string;
      latestCreatedAt: string;
      categoryLatestDate: string | null;
      categoryLatestCreatedAt: string | null;
    }
  >();

  for (const tx of transactions) {
    if (tx.type === "income") continue;

    const name = tx.storeName?.trim();
    if (!name) continue;

    const key = normalizeStoreName(name);
    const date = tx.date || "";
    const createdAt = tx.createdAt || "";
    const existing = storesByName.get(key);
    const matchedCategory =
      !!categoryName && tx.categoryName?.trim() === categoryName;

    if (!existing) {
      storesByName.set(key, {
        name,
        latestDate: date,
        latestCreatedAt: createdAt,
        categoryLatestDate: matchedCategory ? date : null,
        categoryLatestCreatedAt: matchedCategory ? createdAt : null,
      });
      continue;
    }

    if (
      compareStoreRecency(
        existing.latestDate,
        existing.latestCreatedAt,
        date,
        createdAt,
      ) > 0
    ) {
      existing.latestDate = date;
      existing.latestCreatedAt = createdAt;
      existing.name = name;
    }

    if (matchedCategory) {
      if (
        !existing.categoryLatestDate ||
        compareStoreRecency(
          existing.categoryLatestDate,
          existing.categoryLatestCreatedAt ?? "",
          date,
          createdAt,
        ) > 0
      ) {
        existing.categoryLatestDate = date;
        existing.categoryLatestCreatedAt = createdAt;
      }
    }
  }

  return Array.from(storesByName.values())
    .sort((a, b) => {
      const aCategory = !!a.categoryLatestDate;
      const bCategory = !!b.categoryLatestDate;
      if (aCategory !== bCategory) return aCategory ? -1 : 1;

      if (aCategory && bCategory) {
        const categoryRecency = compareStoreRecency(
          a.categoryLatestDate ?? "",
          a.categoryLatestCreatedAt ?? "",
          b.categoryLatestDate ?? "",
          b.categoryLatestCreatedAt ?? "",
        );
        if (categoryRecency !== 0) return categoryRecency;
      }

      const recency = compareStoreRecency(
        a.latestDate,
        a.latestCreatedAt,
        b.latestDate,
        b.latestCreatedAt,
      );
      if (recency !== 0) return recency;
      return a.name.localeCompare(b.name);
    })
    .map((store) => ({
      id: null,
      name: store.name,
      lastUsedDate: store.latestDate,
    }));
}

function pickRecentStore(a: StoreOption, b: StoreOption): StoreOption {
  const recency = b.lastUsedAt.localeCompare(a.lastUsedAt);
  if (recency > 0) return b;
  return a;
}

export function buildStoreOptionsForCategory<T extends StoreOption>(
  stores: T[],
  usages: StoreCategoryUsage[],
  categoryId?: string | null,
): StoreOption[] {
  const usageByStoreId = new Map(
    usages
      .filter((usage) => !categoryId || usage.categoryId === categoryId)
      .map((usage) => [usage.storeId, usage]),
  );
  const priorityStoreIds = new Set(usageByStoreId.keys());
  const storesByName = new Map<string, StoreOption>();

  for (const store of stores) {
    const usage = usageByStoreId.get(store.id);

    const name = store.name.trim();
    if (!name) continue;

    const option = {
      id: store.id,
      name,
      categoryId: store.categoryId,
      lastUsedAt:
        usage && usage.lastUsedAt.localeCompare(store.lastUsedAt) > 0
          ? usage.lastUsedAt
          : store.lastUsedAt,
    };
    const key = normalizeStoreName(name);
    const existing = storesByName.get(key);
    storesByName.set(
      key,
      existing ? pickRecentStore(existing, option) : option,
    );
  }

  return Array.from(storesByName.values()).sort((a, b) => {
    const aPriority = priorityStoreIds.has(a.id);
    const bPriority = priorityStoreIds.has(b.id);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;

    const recency = b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (recency !== 0) return recency;
    return a.name.localeCompare(b.name);
  });
}
