import assert from "node:assert/strict";
import test from "node:test";

import {
    getHistorySearchExpandedAfterClear,
    shouldShowHistorySearchCategoryFilter,
    shouldShowHistorySearchStoreFilter,
} from "./historySearchPanelState";

test("getHistorySearchExpandedAfterClear collapses the search panel", () => {
  assert.equal(getHistorySearchExpandedAfterClear(), false);
});

test("shouldShowHistorySearchCategoryFilter always shows category filter", () => {
  assert.equal(shouldShowHistorySearchCategoryFilter("all"), true);
  assert.equal(shouldShowHistorySearchCategoryFilter("expense"), true);
  assert.equal(shouldShowHistorySearchCategoryFilter("income"), true);
});

test("shouldShowHistorySearchStoreFilter always shows store filter", () => {
  assert.equal(shouldShowHistorySearchStoreFilter("all"), true);
  assert.equal(shouldShowHistorySearchStoreFilter("expense"), true);
  assert.equal(shouldShowHistorySearchStoreFilter("income"), true);
});
