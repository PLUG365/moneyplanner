import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTransactionsUpToDate,
  resolveHistoryDateCutoff,
} from "./historyFutureVisibility";

test("resolveHistoryDateCutoff caps the list at today by default", () => {
  assert.equal(
    resolveHistoryDateCutoff({
      showFutureTransactions: false,
      toDate: null,
      today: "2026-08-07",
    }),
    "2026-08-07",
  );
});

test("resolveHistoryDateCutoff adds no cap once future records are shown", () => {
  assert.equal(
    resolveHistoryDateCutoff({
      showFutureTransactions: true,
      toDate: null,
      today: "2026-08-07",
    }),
    null,
  );
});

test("resolveHistoryDateCutoff defers to an explicit search end date", () => {
  assert.equal(
    resolveHistoryDateCutoff({
      showFutureTransactions: false,
      toDate: "2026-12-31",
      today: "2026-08-07",
    }),
    null,
  );
  assert.equal(
    resolveHistoryDateCutoff({
      showFutureTransactions: false,
      toDate: "   ",
      today: "2026-08-07",
    }),
    "2026-08-07",
  );
});

test("filterTransactionsUpToDate keeps today and drops later dates", () => {
  const transactions = [
    { id: "future", date: "2026-08-08" },
    { id: "today", date: "2026-08-07" },
    { id: "past", date: "2026-08-06" },
  ];

  assert.deepEqual(
    filterTransactionsUpToDate(transactions, "2026-08-07").map((tx) => tx.id),
    ["today", "past"],
  );
});

test("filterTransactionsUpToDate returns the same array when uncapped", () => {
  const transactions = [{ id: "future", date: "2026-08-08" }];
  assert.equal(filterTransactionsUpToDate(transactions, null), transactions);
});

test("filterTransactionsUpToDate drops records without a date", () => {
  assert.deepEqual(
    filterTransactionsUpToDate(
      [{ id: "no-date" }, { id: "dated", date: "2026-08-01" }],
      "2026-08-07",
    ).map((tx) => tx.id),
    ["dated"],
  );
});
