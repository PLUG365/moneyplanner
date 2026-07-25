import assert from "node:assert/strict";
import test from "node:test";

import { buildHistorySearchTotals } from "./historySearchTotals";

test("buildHistorySearchTotals returns zeros for an empty result", () => {
  assert.deepEqual(buildHistorySearchTotals([]), {
    count: 0,
    income: 0,
    expense: 0,
    net: 0,
    hasIncome: false,
    hasExpense: false,
  });
});

test("buildHistorySearchTotals sums expense-only results", () => {
  assert.deepEqual(
    buildHistorySearchTotals([
      { type: "expense", amount: 4280 },
      { type: "expense", amount: 1860 },
    ]),
    {
      count: 2,
      income: 0,
      expense: 6140,
      net: -6140,
      hasIncome: false,
      hasExpense: true,
    },
  );
});

test("buildHistorySearchTotals sums income-only results", () => {
  assert.deepEqual(
    buildHistorySearchTotals([
      { type: "income", amount: 250000 },
      { type: "income", amount: 12000 },
    ]),
    {
      count: 2,
      income: 262000,
      expense: 0,
      net: 262000,
      hasIncome: true,
      hasExpense: false,
    },
  );
});

test("buildHistorySearchTotals separates income and expense when mixed", () => {
  assert.deepEqual(
    buildHistorySearchTotals([
      { type: "income", amount: 250000 },
      { type: "expense", amount: 4280 },
      { type: "expense", amount: 1860 },
    ]),
    {
      count: 3,
      income: 250000,
      expense: 6140,
      net: 243860,
      hasIncome: true,
      hasExpense: true,
    },
  );
});

test("buildHistorySearchTotals treats non-finite amounts as zero", () => {
  assert.deepEqual(
    buildHistorySearchTotals([
      { type: "expense", amount: Number.NaN },
      { type: "expense", amount: 1200 },
      { type: "income", amount: Number.POSITIVE_INFINITY },
    ]),
    {
      count: 3,
      income: 0,
      expense: 1200,
      net: -1200,
      hasIncome: true,
      hasExpense: true,
    },
  );
});
