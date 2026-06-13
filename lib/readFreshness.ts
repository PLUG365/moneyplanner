export type DataVersion = string | null;

export function hasDataVersionChanged(
  cachedVersion: DataVersion,
  currentVersion: DataVersion,
): boolean {
  return cachedVersion !== currentVersion;
}

export function shouldReadServerForScope(input: {
  hasCachedData: boolean;
  scopeVersion: DataVersion;
  currentDataVersion: DataVersion;
}): boolean {
  if (!input.hasCachedData) return true;
  return hasDataVersionChanged(input.scopeVersion, input.currentDataVersion);
}
