type HistoryEditBreakdown = {
  id: string;
  categoryId: string;
  name: string;
};

type HistoryEditStoreResolution =
  | { kind: "selected"; storeId: string }
  | { kind: "restore"; storeName: string; categoryId: string }
  | { kind: "none" };

type QueuedStoreWrite = {
  storeId: string;
  pendingWrite: Promise<unknown>;
};

export type HistoryEditStoreWrite = {
  storeId: string | null;
  pendingWrite: Promise<unknown> | null;
};

export function getHistoryEditEditorBreakdowns<T extends HistoryEditBreakdown>(
  breakdowns: T[],
): T[] {
  return breakdowns;
}

export async function resolveHistoryEditStoreForWrite(
  resolution: HistoryEditStoreResolution,
  restoreStore: (name: string, categoryId: string) => Promise<QueuedStoreWrite>,
): Promise<HistoryEditStoreWrite> {
  if (resolution.kind === "selected") {
    return { storeId: resolution.storeId, pendingWrite: null };
  }
  if (resolution.kind === "restore") {
    return restoreStore(resolution.storeName, resolution.categoryId);
  }

  return { storeId: null, pendingWrite: null };
}
