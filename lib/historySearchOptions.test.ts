import assert from "node:assert/strict";
import test from "node:test";

import {
    buildHistorySearchBreakdownOptions,
    buildHistorySearchCategoryOptions,
    buildHistorySearchStoreOptions,
} from "./historySearchOptions";

const transactions = [
  {
    type: "expense" as const,
    categoryName: "食費",
    breakdownName: "スーパー",
    storeName: "駅前スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "日用品",
    breakdownName: "消耗品",
    storeName: "駅前スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "食費",
    breakdownName: "スーパー",
    storeName: "港スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "食費",
    breakdownName: "外食",
    storeName: "駅ビル薬局",
  },
  {
    type: "income" as const,
    categoryName: "給与",
    breakdownName: "本業",
    storeName: "会社",
  },
];

test("buildHistorySearchStoreOptions limits unique expense stores in list order", () => {
  assert.deepEqual(
    buildHistorySearchStoreOptions(transactions, {
      categoryName: "",
      storeQuery: "",
      limit: 2,
    }),
    ["駅前スーパー", "港スーパー"],
  );
});

test("buildHistorySearchStoreOptions narrows by selected category", () => {
  assert.deepEqual(
    buildHistorySearchStoreOptions(transactions, {
      categoryName: "日用品",
      storeQuery: "",
      limit: 10,
    }),
    ["駅前スーパー"],
  );
});

test("buildHistorySearchStoreOptions narrows by partial store text", () => {
  assert.deepEqual(
    buildHistorySearchStoreOptions(transactions, {
      categoryName: "",
      storeQuery: "スーパー",
      limit: 10,
    }),
    ["駅前スーパー", "港スーパー"],
  );
});

test("buildHistorySearchStoreOptions searches cached all-history stores beyond the visible list", () => {
  const visibleTransactions = [transactions[0]];
  const cachedTransactions = [
    ...visibleTransactions,
    {
      type: "expense" as const,
      categoryName: "食費",
      breakdownName: "スーパー",
      storeName: "遠方スーパー",
    },
  ];

  assert.deepEqual(
    buildHistorySearchStoreOptions(
      visibleTransactions,
      {
        categoryName: "",
        storeQuery: "遠方",
        limit: 10,
      },
      cachedTransactions,
    ),
    ["遠方スーパー"],
  );
});

test("buildHistorySearchCategoryOptions includes both income and expense categories for all type", () => {
  assert.deepEqual(buildHistorySearchCategoryOptions(transactions, "all"), [
    "食費",
    "日用品",
    "給与",
  ]);
});

test("buildHistorySearchCategoryOptions narrows categories by selected type", () => {
  assert.deepEqual(buildHistorySearchCategoryOptions(transactions, "expense"), [
    "食費",
    "日用品",
  ]);
  assert.deepEqual(buildHistorySearchCategoryOptions(transactions, "income"), [
    "給与",
  ]);
});

test("buildHistorySearchCategoryOptions searches cached all-history categories beyond the visible list", () => {
  const visibleTransactions = [transactions[0]];
  const cachedTransactions = [
    ...visibleTransactions,
    {
      type: "expense" as const,
      categoryName: "医療費",
      breakdownName: "薬",
      storeName: "薬局",
    },
  ];

  assert.deepEqual(
    buildHistorySearchCategoryOptions(
      visibleTransactions,
      "expense",
      cachedTransactions,
    ),
    ["食費", "医療費"],
  );
});

test("buildHistorySearchBreakdownOptions includes matching category breakdowns for all type", () => {
  assert.deepEqual(
    buildHistorySearchBreakdownOptions(transactions, {
      type: "all",
      categoryName: "食費",
    }),
    ["スーパー", "外食"],
  );
});

test("buildHistorySearchBreakdownOptions narrows breakdowns by selected type", () => {
  assert.deepEqual(
    buildHistorySearchBreakdownOptions(transactions, {
      type: "income",
      categoryName: "給与",
    }),
    ["本業"],
  );
});

test("buildHistorySearchBreakdownOptions searches cached all-history breakdowns beyond the visible list", () => {
  const visibleTransactions = [transactions[0]];
  const cachedTransactions = [
    ...visibleTransactions,
    {
      type: "expense" as const,
      categoryName: "食費",
      breakdownName: "まとめ買い",
      storeName: "大型スーパー",
    },
  ];

  assert.deepEqual(
    buildHistorySearchBreakdownOptions(
      visibleTransactions,
      {
        type: "expense",
        categoryName: "食費",
      },
      cachedTransactions,
    ),
    ["スーパー", "まとめ買い"],
  );
});
