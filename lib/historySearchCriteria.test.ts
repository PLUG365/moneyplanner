import assert from "node:assert/strict";
import test from "node:test";

import { hasHistorySearchCriteria } from "./historySearchCriteria";

test("hasHistorySearchCriteria is false for the default all-history criteria", () => {
  assert.equal(
    hasHistorySearchCriteria({
      type: "all",
      categoryName: "",
      breakdownName: "",
      storeName: "",
      memoQuery: "",
      fromDate: null,
      toDate: null,
    }),
    false,
  );
});

test("hasHistorySearchCriteria is true when any searchable condition is set", () => {
  assert.equal(hasHistorySearchCriteria({ type: "expense" }), true);
  assert.equal(hasHistorySearchCriteria({ type: "all", categoryName: "食費" }), true);
  assert.equal(hasHistorySearchCriteria({ type: "all", storeName: "スーパー" }), true);
  assert.equal(hasHistorySearchCriteria({ type: "all", memoQuery: "弁当" }), true);
  assert.equal(hasHistorySearchCriteria({ type: "all", fromDate: "2026-05-01" }), true);
  assert.equal(hasHistorySearchCriteria({ type: "all", toDate: "2026-05-31" }), true);
});
