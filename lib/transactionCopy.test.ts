import assert from "node:assert/strict";
import test from "node:test";

import { resolveTransactionCopyTarget } from "./transactionCopy";

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
