import type { HistorySearchCriteria } from "./historySearch";

function hasText(value?: string | null): boolean {
  return !!value?.trim();
}

export function hasHistorySearchCriteria(
  criteria: HistorySearchCriteria,
): boolean {
  return (
    criteria.type !== "all" ||
    hasText(criteria.categoryName) ||
    hasText(criteria.breakdownName) ||
    hasText(criteria.storeName) ||
    hasText(criteria.memoQuery) ||
    hasText(criteria.fromDate) ||
    hasText(criteria.toDate)
  );
}
