import assert from "node:assert/strict";
import test from "node:test";

import {
    buildHistorySearchConditionSummary,
    filterHistoryTransactions,
} from "./historySearch";

const transactions = [
  {
    id: "expense-food",
    date: "2026-05-01",
    type: "expense" as const,
    categoryName: "食費",
    breakdownName: "昼ご飯",
    storeName: "駅前スーパー",
    accountName: "家計",
    memo: "弁当",
  },
  {
    id: "expense-utility",
    date: "2026-05-02",
    type: "expense" as const,
    categoryName: "水道光熱費",
    breakdownName: "電気",
    storeName: "",
    accountName: "家計",
    memo: "",
  },
  {
    id: "income-salary",
    date: "2026-05-03",
    type: "income" as const,
    categoryName: "給与",
    breakdownName: "",
    storeName: "",
    accountName: "銀行",
    memo: "5月分",
  },
];

test("filterHistoryTransactions filters by transaction type", () => {
  assert.deepEqual(
    filterHistoryTransactions(transactions, { type: "income" }).map(
      (tx) => tx.id,
    ),
    ["income-salary"],
  );
});

test("filterHistoryTransactions filters by selected category, breakdown, and store", () => {
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      categoryName: "食費",
      breakdownName: "昼ご飯",
      storeName: "駅前スーパー",
    }).map((tx) => tx.id),
    ["expense-food"],
  );

  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      categoryName: "水道光熱費",
    }).map((tx) => tx.id),
    ["expense-utility"],
  );
});

test("filterHistoryTransactions applies store condition to income search", () => {
  // income-salary has empty storeName, so specifying a store filters it out
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "income",
      storeName: "駅前スーパー",
    }).map((tx) => tx.id),
    [],
  );
  // without store condition, income is returned normally
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "income",
    }).map((tx) => tx.id),
    ["income-salary"],
  );
});

test("filterHistoryTransactions matches memo by partial text", () => {
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      memoQuery: "弁",
    }).map((tx) => tx.id),
    ["expense-food"],
  );
});

test("filterHistoryTransactions filters by optional date range", () => {
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      fromDate: "2026-05-02",
    }).map((tx) => tx.id),
    ["expense-utility"],
  );

  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      toDate: "2026-05-01",
    }).map((tx) => tx.id),
    ["expense-food"],
  );
});

test("filterHistoryTransactions ignores blank conditions", () => {
  assert.deepEqual(
    filterHistoryTransactions(transactions, {
      type: "expense",
      categoryName: "",
      breakdownName: "  ",
      storeName: "",
      memoQuery: "  ",
    }).map((tx) => tx.id),
    ["expense-food", "expense-utility"],
  );
});

test("buildHistorySearchConditionSummary reports expense type as one condition", () => {
  assert.deepEqual(buildHistorySearchConditionSummary({ type: "expense" }), {
    count: 1,
    label: "支出",
  });
});

test("buildHistorySearchConditionSummary reports no conditions for all type", () => {
  assert.deepEqual(buildHistorySearchConditionSummary({ type: "all" }), {
    count: 0,
    label: "条件なし",
  });
});

test("buildHistorySearchConditionSummary includes active type and filters", () => {
  assert.deepEqual(
    buildHistorySearchConditionSummary({
      type: "income",
      categoryName: "給与",
      memoQuery: "5月",
      fromDate: "2026-05-01",
      toDate: "2026-05-31",
    }),
    { count: 4, label: "収入 / 給与 / メモ: 5月 / 2026-05-01〜2026-05-31" },
  );
});
