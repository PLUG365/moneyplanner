type SnapshotLike<T> = {
  exists: boolean | (() => boolean);
  data: () => T | undefined;
};

export function snapshotExists(snapshot: {
  exists: boolean | (() => boolean);
}): boolean {
  return typeof snapshot.exists === "function"
    ? snapshot.exists()
    : snapshot.exists;
}

export function getSnapshotDataOrNull<T>(snapshot: SnapshotLike<T>): T | null {
  if (!snapshotExists(snapshot)) {
    return null;
  }

  return snapshot.data() ?? null;
}
