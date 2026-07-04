import type { HistorySearchType } from "./historySearch";

export function getHistorySearchExpandedAfterClear(): boolean {
  return false;
}

export function shouldShowHistorySearchCategoryFilter(
  _type: HistorySearchType,
): boolean {
  return true;
}

export function shouldShowHistorySearchStoreFilter(
  _type: HistorySearchType,
): boolean {
  return true;
}
