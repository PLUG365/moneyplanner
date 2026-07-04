export type PaginatedTransactionsRangeLike = {
  from: string | null;
  to: string | null;
};

export function shouldFetchAllTransactions(input: {
  readAll: boolean;
  range: PaginatedTransactionsRangeLike;
}): boolean {
  return input.readAll || !!(input.range.from && input.range.to);
}

export function buildPaginatedTransactionsScopeKey(
  householdId: string,
  range: PaginatedTransactionsRangeLike,
  readAll: boolean,
): string {
  const mode = readAll ? "all" : "page";
  return `${householdId}:transactions:history:${mode}:${range.from ?? ""}:${
    range.to ?? ""
  }`;
}

function versionToMillis(version: string): number | null {
  const numeric = Number(version);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = new Date(version).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function pickNewestDataVersion(
  left: string | null,
  right: string | null,
): string | null {
  if (left == null) return right;
  if (right == null) return left;
  const leftMillis = versionToMillis(left);
  const rightMillis = versionToMillis(right);
  if (leftMillis == null || rightMillis == null) return right;
  return leftMillis >= rightMillis ? left : right;
}
