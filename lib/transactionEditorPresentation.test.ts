import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCategoryDisplayName,
    getBreakdownChoicesForCategory,
    getCategoryModalNextStep,
    shouldShowBreakdownChoicesInEditor,
} from "./transactionEditorPresentation";

test("getBreakdownChoicesForCategory filters subscribed breakdowns for the selected category", () => {
  assert.deepEqual(
    getBreakdownChoicesForCategory("food", [
      { id: "bd-food", categoryId: "food", name: "外食" },
      { id: "bd-daily", categoryId: "daily", name: "洗剤" },
    ]),
    [{ id: "bd-food", categoryId: "food", name: "外食" }],
  );
});

test("buildCategoryDisplayName shows only the category when breakdown is not selected", () => {
  assert.equal(
    buildCategoryDisplayName({ categoryName: "食費", breakdownName: "" }),
    "食費",
  );
});

test("buildCategoryDisplayName joins category and breakdown when breakdown is selected", () => {
  assert.equal(
    buildCategoryDisplayName({ categoryName: "食費", breakdownName: "外食" }),
    "食費 - 外食",
  );
});

test("buildCategoryDisplayName falls back to the prompt when category is not selected", () => {
  assert.equal(
    buildCategoryDisplayName({ categoryName: null, breakdownName: "外食" }),
    "カテゴリを選択",
  );
});

test("shouldShowBreakdownChoicesInEditor never reserves main editor space", () => {
  assert.equal(
    shouldShowBreakdownChoicesInEditor(null, [{ id: "bd1" }]),
    false,
  );
  assert.equal(shouldShowBreakdownChoicesInEditor("cat1", []), false);
  assert.equal(
    shouldShowBreakdownChoicesInEditor("cat1", [{ id: "bd1" }]),
    false,
  );
});

test("getCategoryModalNextStep closes when selected category has no breakdowns", () => {
  assert.equal(getCategoryModalNextStep(0), "close");
});

test("getCategoryModalNextStep requires a breakdown step when breakdowns exist", () => {
  assert.equal(getCategoryModalNextStep(1), "breakdown");
  assert.equal(getCategoryModalNextStep(3), "breakdown");
});
