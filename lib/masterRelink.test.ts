import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBudgetMasterRestorePlan,
    buildStoreMasterRestorePlan,
    buildTransactionMasterRelinkPatch,
} from "./masterRelink";

test("buildTransactionMasterRelinkPatch relinks category and breakdown by snapshot names", () => {
  const patch = buildTransactionMasterRelinkPatch(
    {
      type: "expense",
      categoryName: "食費",
      breakdownName: "昼ご飯",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map([
        [
          "cat-food",
          [
            { id: "bd-dinner", categoryId: "cat-food", name: "晩ご飯" },
            { id: "bd-lunch", categoryId: "cat-food", name: "昼ご飯" },
          ],
        ],
      ]),
    },
  );

  assert.deepEqual(patch, {
    categoryId: "cat-food",
    breakdownId: "bd-lunch",
    storeId: null,
  });
});

test("buildTransactionMasterRelinkPatch clears ids when no category name matches", () => {
  const patch = buildTransactionMasterRelinkPatch(
    {
      type: "expense",
      categoryName: "独自カテゴリ",
      breakdownName: "独自内訳",
    },
    {
      categories: [{ id: "cat-food", name: "食費", type: "expense" }],
      breakdownsByCategory: new Map(),
    },
  );

  assert.deepEqual(patch, {
    categoryId: null,
    breakdownId: null,
    storeId: null,
  });
});

test("buildStoreMasterRestorePlan restores stores from transaction snapshots after category reset", () => {
  const plan = buildStoreMasterRestorePlan([
    {
      transactionId: "tx-1",
      type: "expense",
      storeName: "スーパーA",
      categoryId: "cat-food",
    },
    {
      transactionId: "tx-2",
      type: "expense",
      storeName: " スーパーA ",
      categoryId: "cat-daily",
    },
    {
      transactionId: "tx-3",
      type: "income",
      storeName: "勤務先",
      categoryId: "cat-income",
    },
    {
      transactionId: "tx-4",
      type: "expense",
      storeName: "",
      categoryId: "cat-food",
    },
  ]);

  assert.deepEqual(plan.stores, [
    {
      key: "スーパーa",
      name: "スーパーA",
      categoryId: "cat-food",
    },
  ]);
  assert.deepEqual(Array.from(plan.transactionStoreKeys.entries()), [
    ["tx-1", "スーパーa"],
    ["tx-2", "スーパーa"],
  ]);
  assert.deepEqual(plan.usages, [
    { storeKey: "スーパーa", categoryId: "cat-food" },
    { storeKey: "スーパーa", categoryId: "cat-daily" },
  ]);
});

test("buildBudgetMasterRestorePlan restores matched expense budgets to reset category ids", () => {
  const plan = buildBudgetMasterRestorePlan(
    [
      { categoryId: "old-food", amount: 45000 },
      { categoryId: "old-custom", amount: 12000 },
      { categoryId: "old-income", amount: 300000 },
    ],
    [
      { id: "old-food", name: "食費", type: "expense" },
      { id: "old-custom", name: "独自費目", type: "expense" },
      { id: "old-income", name: "給与", type: "income" },
    ],
    [
      { id: "new-food", name: "食費", type: "expense" },
      { id: "new-income", name: "給与", type: "income" },
    ],
  );

  assert.deepEqual(plan, [{ categoryId: "new-food", amount: 45000 }]);
});
