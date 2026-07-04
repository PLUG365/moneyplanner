import assert from "node:assert/strict";
import test from "node:test";

import { getHistorySearchExpandedAfterClear } from "./historySearchPanelState";

test("getHistorySearchExpandedAfterClear collapses the search panel", () => {
  assert.equal(getHistorySearchExpandedAfterClear(), false);
});