export function buildFirestoreQueryKey(
  householdId: string | null | undefined,
  collectionName: string,
  scope = "all",
): string | null {
  if (!householdId) return null;
  return `${householdId}:${collectionName}:${scope}`;
}
