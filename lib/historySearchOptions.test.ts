import assert from "node:assert/strict";
import test from "node:test";

import { buildHistorySearchStoreOptions } from "./historySearchOptions";

const transactions = [
  {
    type: "expense" as const,
    categoryName: "食費",
    storeName: "駅前スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "日用品",
    storeName: "駅前スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "食費",
    storeName: "港スーパー",
  },
  {
    type: "expense" as const,
    categoryName: "食費",
    storeName: "駅ビル薬局",
  },
  {
    type: "income" as const,
    categoryName: "給与",
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
