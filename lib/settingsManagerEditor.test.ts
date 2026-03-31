import assert from "node:assert/strict";
import test from "node:test";

import {
    buildAccountEditorDraft,
    buildBreakdownEditorDraft,
    buildCategoryEditorDraft,
    buildEditorMeta,
    buildEmptyAccountEditorDraft,
    buildEmptyBreakdownEditorDraft,
    buildEmptyCategoryEditorDraft,
} from "./settingsManagerEditor";

test("buildEditorMeta returns add labels for category", () => {
  assert.deepEqual(buildEditorMeta("category", false), {
    title: "カテゴリを追加",
    submitLabel: "追加",
  });
});

test("buildEditorMeta returns edit labels for account", () => {
  assert.deepEqual(buildEditorMeta("account", true), {
    title: "口座を編集",
    submitLabel: "更新",
  });
});

test("buildEmptyCategoryEditorDraft returns tab-aware default color", () => {
  assert.deepEqual(buildEmptyCategoryEditorDraft("income", "#1565C0"), {
    name: "",
    color: "#1565C0",
  });
});

test("buildCategoryEditorDraft copies editable fields", () => {
  assert.deepEqual(
    buildCategoryEditorDraft({
      id: 1,
      name: "食費",
      type: "expense",
      color: "#C62828",
      isDefault: false,
    }),
    { name: "食費", color: "#C62828" },
  );
});

test("buildBreakdownEditorDraft and buildAccountEditorDraft copy source values", () => {
  assert.deepEqual(
    buildBreakdownEditorDraft({
      id: 2,
      categoryId: 1,
      name: "昼ご飯",
      isDefault: false,
    }),
    { name: "昼ご飯" },
  );
  assert.deepEqual(
    buildAccountEditorDraft({
      id: 3,
      name: "財布",
      balance: 12000,
      isDefault: false,
      createdAt: "2026-03-31",
      updatedAt: "2026-03-31",
    }),
    { name: "財布", balance: "12000" },
  );
});

test("build empty drafts for breakdown/account start blank", () => {
  assert.deepEqual(buildEmptyBreakdownEditorDraft(), { name: "" });
  assert.deepEqual(buildEmptyAccountEditorDraft(), { name: "", balance: "" });
});
