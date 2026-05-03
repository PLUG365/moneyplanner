type HistoryListTransaction = {
  date: string;
  createdAt: string;
};

export function buildHistoryListTransactions<T extends HistoryListTransaction>(
  transactions: T[],
): T[] {
  return [...transactions].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
