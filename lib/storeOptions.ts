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
