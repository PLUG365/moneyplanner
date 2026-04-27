import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBudgetStatusesFromData,
    buildMonthCategorySummaryFromTransactions,
    buildYearMonthlyTotalsFromTransactions,
} from "./summaryAggregation";

test("buildMonthCategorySummaryFromTransactions groups current month by type and category", () => {
  const summary = buildMonthCategorySummaryFromTransactions(
    [
      {
        date: "2026-04-01",
        amount: 1000,
        type: "expense",
        categoryId: "food",
        categoryName: "食費",
        categoryColor: "#111111",
      },
      {
        date: "2026-04-02",
        amount: 500,
        type: "expense",
        categoryId: "food",
        categoryName: "食費",
        categoryColor: "#111111",
      },
      {
        date: "2026-05-01",
        amount: 9999,
        type: "expense",
        categoryId: "food",
        categoryName: "食費",
        categoryColor: "#111111",
      },
      {
        date: "2026-04-25",
        amount: 300000,
        type: "income",
        categoryId: "salary",
        categoryName: "給与",
        categoryColor: "#222222",
      },
    ],
    2026,
    4,
  );

  assert.deepEqual(summary, [
    {
      type: "expense",
      categoryId: "food",
      categoryName: "食費",
      categoryColor: "#111111",
      total: 1500,
    },
    {
      type: "income",
      categoryId: "salary",
      categoryName: "給与",
      categoryColor: "#222222",
      total: 300000,
    },
  ]);
});

test("buildBudgetStatusesFromData computes warning and exceeded levels", () => {
  const statuses = buildBudgetStatusesFromData({
    year: 2026,
    month: 4,
    transactions: [
      {
        date: "2026-04-01",
        amount: 9000,
        type: "expense",
        categoryId: "food",
        categoryName: "食費",
        categoryColor: "#111111",
      },
      {
        date: "2026-04-02",
        amount: 12000,
        type: "expense",
        categoryId: "daily",
        categoryName: "日用品",
        categoryColor: "#222222",
      },
    ],
    budgets: [
      { categoryId: "food", amount: 10000 },
      { categoryId: "daily", amount: 10000 },
    ],
    categories: [
      { id: "food", name: "食費", type: "expense", color: "#111111" },
      { id: "daily", name: "日用品", type: "expense", color: "#222222" },
    ],
  });

  assert.deepEqual(
    statuses.map((status) => ({
      categoryId: status.categoryId,
      level: status.level,
    })),
    [
      { categoryId: "daily", level: "exceeded" },
      { categoryId: "food", level: "warning" },
    ],
  );
});

test("buildYearMonthlyTotalsFromTransactions totals each month", () => {
  const totals = buildYearMonthlyTotalsFromTransactions(
    [
      { date: "2026-01-01", amount: 100, type: "income" },
      { date: "2026-01-02", amount: 40, type: "expense" },
      { date: "2026-02-01", amount: 200, type: "income" },
      { date: "2025-01-01", amount: 999, type: "income" },
    ],
    2026,
  );

  assert.equal(totals.length, 12);
  assert.deepEqual(totals[0], { month: 1, income: 100, expense: 40 });
  assert.deepEqual(totals[1], { month: 2, income: 200, expense: 0 });
});
