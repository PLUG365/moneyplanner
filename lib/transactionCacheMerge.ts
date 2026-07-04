export type TransactionCacheItem = {
  id: string;
  date: string;
  createdAt: string;
};

export function mergeTransactionCacheItems<T extends TransactionCacheItem>(
  currentItems: T[],
  changedActiveItems: T[],
  deletedIds: Set<string>,
): T[] {
  const changedById = new Map(changedActiveItems.map((item) => [item.id, item]));
  const retained = currentItems.filter(
    (item) => !deletedIds.has(item.id) && !changedById.has(item.id),
  );
  return [...retained, ...changedActiveItems].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
