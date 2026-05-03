import assert from "node:assert/strict";
import { test } from "node:test";

import {
    buildHistorySearchPreviewOptions,
    historySearchPreviewTransactions,
} from "./historySearchPreview";

test("history search preview data includes expense and income examples", () => {
  const types = new Set(historySearchPreviewTransactions.map((tx) => tx.type));

  assert.equal(types.has("expense"), true);
  assert.equal(types.has("income"), true);
});

test("buildHistorySearchPreviewOptions narrows breakdowns and stores by selected expense category", () => {
  const options = buildHistorySearchPreviewOptions(
    historySearchPreviewTransactions,
    "expense",
    "食費",
  );

  assert.deepEqual(options.categoryOptions, ["食費", "日用品", "交通"]);
  assert.deepEqual(options.breakdownOptions, ["スーパー", "外食"]);
  assert.deepEqual(options.storeOptions, ["駅前スーパー", "定食屋あおば"]);
});

test("buildHistorySearchPreviewOptions does not expose store options for income", () => {
  const options = buildHistorySearchPreviewOptions(
    historySearchPreviewTransactions,
    "income",
    "給与",
  );

  assert.deepEqual(options.categoryOptions, ["給与", "臨時収入"]);
  assert.deepEqual(options.breakdownOptions, ["本業"]);
  assert.deepEqual(options.storeOptions, []);
});
