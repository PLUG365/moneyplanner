import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBreakdownsByCategory,
    resolveTransactionCopyTarget,
    resolveTransactionMasterSelection,
} from "./transactionCopy";

test("buildBreakdownsByCategory groups subscribed breakdowns by category", () => {
  const grouped = buildBreakdownsByCategory([
    { id: "bd-food-1", categoryId: "food", name: "外食" },
    { id: "bd-daily-1", categoryId: "daily", name: "洗剤" },
    { id: "bd-food-2", categoryId: "food", name: "自炊" },
  ]);

  assert.deepEqual(Array.from(grouped.entries()), [
    [
      "food",
      [
        { id: "bd-food-1", categoryId: "food", name: "外食" },
        { id: "bd-food-2", categoryId: "food", name: "自炊" },
      ],
    ],
    ["daily", [{ id: "bd-daily-1", categoryId: "daily", name: "洗剤" }]],
  ]);
});

test("resolveTransactionCopyTarget keeps valid current ids", () => {
  const result = resolveTransactionCopyTarget(
    {
      id: "tx-1",
      type: "expense",
      categoryId: "cat-food",
      categoryName: "食費",
      breakdownId: "bd-dinner",
      breakdownName: "晩ご飯",
      accountId: "wallet",
      accountName: "財布",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map([
        [
          "cat-food",
          [{ id: "bd-dinner", categoryId: "cat-food", name: "晩ご飯" }],
        ],
      ]),
      accounts: [{ id: "wallet", name: "財布" }],
      defaultAccountId: "default",
    },
  );

  assert.deepEqual(result, {
    categoryId: "cat-food",
    breakdownId: "bd-dinner",
    accountId: "wallet",
  });
});

test("resolveTransactionCopyTarget falls back to snapshot names", () => {
  const result = resolveTransactionCopyTarget(
    {
      id: "tx-2",
      type: "expense",
      categoryId: "deleted-cat",
      categoryName: "食費",
      breakdownId: "deleted-bd",
      breakdownName: "晩ご飯",
      accountId: "deleted-account",
      accountName: "財布",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map([
        [
          "cat-food",
          [{ id: "bd-dinner", categoryId: "cat-food", name: "晩ご飯" }],
        ],
      ]),
      accounts: [
        { id: "default", name: "家計" },
        { id: "wallet", name: "財布" },
      ],
      defaultAccountId: "default",
    },
  );

  assert.deepEqual(result, {
    categoryId: "cat-food",
    breakdownId: "bd-dinner",
    accountId: "wallet",
  });
});

test("resolveTransactionCopyTarget returns null when category cannot be resolved", () => {
  const result = resolveTransactionCopyTarget(
    {
      id: "tx-3",
      type: "income",
      categoryId: "missing",
      categoryName: "不明な収入",
      breakdownId: null,
      breakdownName: "",
      accountId: "missing",
      accountName: "",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map(),
      accounts: [{ id: "default", name: "家計" }],
      defaultAccountId: "default",
    },
  );

  assert.equal(result, null);
});

test("resolveTransactionMasterSelection falls back to snapshot category and breakdown names", () => {
  const result = resolveTransactionMasterSelection(
    {
      type: "expense",
      categoryId: "old-cat",
      categoryName: "食費",
      breakdownId: "old-bd",
      breakdownName: "外食",
    },
    {
      categories: [
        { id: "cat-income", name: "食費", type: "income" },
        { id: "cat-food", name: "食費", type: "expense" },
      ],
      breakdownsByCategory: new Map([
        [
          "cat-food",
          [
            { id: "bd-home", categoryId: "cat-food", name: "自炊" },
            { id: "bd-eat-out", categoryId: "cat-food", name: "外食" },
          ],
        ],
      ]),
    },
  );

  assert.deepEqual(result, {
    categoryId: "cat-food",
    breakdownId: "bd-eat-out",
  });
});

test("resolveTransactionMasterSelection keeps empty breakdown when snapshot has none", () => {
  const result = resolveTransactionMasterSelection(
    {
      type: "expense",
      categoryId: "old-cat",
      categoryName: "交通費",
      breakdownId: "old-bd",
      breakdownName: "",
    },
    {
      categories: [{ id: "cat-transport", name: "交通費", type: "expense" }],
      breakdownsByCategory: new Map([
        [
          "cat-transport",
          [{ id: "bd-train", categoryId: "cat-transport", name: "電車" }],
        ],
      ]),
    },
  );

  assert.deepEqual(result, {
    categoryId: "cat-transport",
    breakdownId: null,
  });
});
