import assert from "node:assert/strict";
import test from "node:test";

import {
    buildHistoryDrilldownParams,
    parseHistoryDrilldownParams,
} from "./historyDrilldown";

test("buildHistoryDrilldownParams creates monthly category search params", () => {
  assert.deepEqual(
    buildHistoryDrilldownParams({
      type: "expense",
      categoryName: "食費",
      year: 2026,
      month: 5,
    }),
    {
      historyType: "expense",
      categoryName: "食費",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      expandSearch: "0",
    },
  );
});

test("buildHistoryDrilldownParams creates monthly total search params without a category", () => {
  assert.deepEqual(
    buildHistoryDrilldownParams({
      type: "income",
      categoryName: "",
      year: 2026,
      month: 5,
    }),
    {
      historyType: "income",
      categoryName: "",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      expandSearch: "0",
    },
  );
});

test("buildHistoryDrilldownParams uses the real last day of February", () => {
  assert.equal(
    buildHistoryDrilldownParams({
      type: "income",
      categoryName: "給与",
      year: 2024,
      month: 2,
    }).toDate,
    "2024-02-29",
  );
});

test("parseHistoryDrilldownParams accepts valid params and rejects invalid type", () => {
  assert.deepEqual(
    parseHistoryDrilldownParams({
      historyType: "income",
      categoryName: "給与",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      expandSearch: "1",
    }),
    {
      type: "income",
      categoryName: "給与",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
      expandSearch: true,
    },
  );

  assert.equal(
    parseHistoryDrilldownParams({ historyType: "all", categoryName: "食費" }),
    null,
  );
});
