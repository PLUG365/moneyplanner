import assert from "node:assert/strict";
import test from "node:test";

import { buildCsvRowsFromTransactions } from "./csvExportRows";

test("buildCsvRowsFromTransactions maps Firestore transaction snapshots to CSV rows", () => {
  const rows = buildCsvRowsFromTransactions([
    {
      date: "2026-04-26",
      amount: 980,
      type: "expense",
      accountName: "家計",
      categoryName: "食費",
      breakdownName: "夕食",
      memo: "弁当",
    },
  ]);

  assert.deepEqual(rows, [
    {
      date: "2026-04-26",
      type: "expense",
      accountName: "家計",
      categoryName: "食費",
      breakdownName: "夕食",
      amount: 980,
      memo: "弁当",
    },
  ]);
});

test("buildCsvRowsFromTransactions fills nullable snapshot fields with empty strings", () => {
  const rows = buildCsvRowsFromTransactions([
    {
      date: "2026-04-26",
      amount: 1200,
      type: "income",
      accountName: undefined,
      categoryName: undefined,
      breakdownName: undefined,
      memo: undefined,
    },
  ]);

  assert.deepEqual(rows, [
    {
      date: "2026-04-26",
      type: "income",
      accountName: "",
      categoryName: "",
      breakdownName: "",
      amount: 1200,
      memo: "",
    },
  ]);
});
