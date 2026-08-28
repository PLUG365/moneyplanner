import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBreakdownsByCategory,
    getSelectionCopyButtonLabel,
    resolveEditInitialCategoryId,
    resolveTransactionCopyTarget,
    resolveTransactionMasterSelection,
} from "./transactionCopy";

test("getSelectionCopyButtonLabel shows selected count in parentheses", () => {
  assert.equal(getSelectionCopyButtonLabel(0), "コピー(0)");
  assert.equal(getSelectionCopyButtonLabel(3), "コピー(3)");
});

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
    accountFallback: false,
    categoryFallback: false,
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
    accountFallback: false,
    categoryFallback: false,
  });
});

test("resolveTransactionCopyTarget keeps the deleted category as-is instead of failing", () => {
  const result = resolveTransactionCopyTarget(
    {
      id: "tx-3",
      type: "income",
      categoryId: "missing",
      categoryName: "不明な収入",
      breakdownId: "missing-bd",
      breakdownName: "臨時",
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

  assert.deepEqual(result, {
    categoryId: "missing",
    breakdownId: "missing-bd",
    accountId: "default",
    accountFallback: true,
    categoryFallback: true,
  });
});

test("resolveTransactionCopyTarget tolerates a source without any category id", () => {
  const result = resolveTransactionCopyTarget(
    {
      id: "tx-4",
      type: "expense",
      categoryId: null,
      categoryName: "",
      breakdownId: null,
      breakdownName: "",
      accountId: "wallet",
      accountName: "財布",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map(),
      accounts: [{ id: "wallet", name: "財布" }],
      defaultAccountId: "wallet",
    },
  );

  assert.deepEqual(result, {
    categoryId: "",
    breakdownId: null,
    accountId: "wallet",
    accountFallback: false,
    categoryFallback: true,
  });
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

test("resolveEditInitialCategoryId uses the resolved selection when found", () => {
  const result = resolveEditInitialCategoryId(
    { categoryId: "cat-food", breakdownId: null },
    true,
    "old-cat",
    "cat-salary",
  );

  assert.equal(result, "cat-food");
});

test("resolveEditInitialCategoryId keeps the original id instead of the first master category when a preferred category was given but unresolved", () => {
  // 再現ケース: CSVインポートで「副業」（income）が未分類のまま取り込まれた記録
  // （categoryId: null）を開いたとき、マスタ先頭の「給与所得」へ無条件で
  // フォールバックしていたのが本来のバグ。記録由来の指定があるときは
  // 解決できなくても元のIDをそのまま保つ。
  const result = resolveEditInitialCategoryId(null, true, null, "cat-salary");

  assert.equal(result, null);
});

test("resolveEditInitialCategoryId keeps a stale non-null id when a preferred category was given but unresolved", () => {
  const result = resolveEditInitialCategoryId(
    null,
    true,
    "deleted-cat",
    "cat-salary",
  );

  assert.equal(result, "deleted-cat");
});

test("resolveEditInitialCategoryId falls back to the first master category only when no preferred category was given (type change)", () => {
  const result = resolveEditInitialCategoryId(null, false, null, "cat-salary");

  assert.equal(result, "cat-salary");
});

test("resolveTransactionMasterSelection does not match a category via an empty snapshot name", () => {
  // 内訳側は空文字ガードがあるが（source.breakdownName.trim() ? ... : undefined）、
  // カテゴリ側には無かった。空/破損データでカテゴリ名が空になった場合に、
  // 同じく空の名前を持つ別カテゴリへ誤って一致しないことを確認する。
  const result = resolveTransactionMasterSelection(
    {
      type: "expense",
      categoryId: null,
      categoryName: "",
      breakdownId: null,
      breakdownName: "",
    },
    {
      categories: [{ id: "cat-blank", name: "", type: "expense" }],
      breakdownsByCategory: new Map(),
    },
  );

  assert.equal(result, null);
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
