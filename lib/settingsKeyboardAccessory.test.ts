import assert from "node:assert/strict";
import test from "node:test";

import {
    formatYenDisplay,
    getSettingsKeyboardAccessoryPreview,
} from "./settingsKeyboardAccessory";

test("formatYenDisplay formats raw digits as yen", () => {
  assert.equal(formatYenDisplay("123456"), "¥123,456");
  assert.equal(formatYenDisplay(""), "");
});

test("getSettingsKeyboardAccessoryPreview returns category name preview", () => {
  const preview = getSettingsKeyboardAccessoryPreview(
    { kind: "category-name" },
    {
      categoryName: "食費",
      breakdownName: "",
      accountName: "",
      accountBalance: "",
      budgetValue: "",
    },
  );

  assert.deepEqual(preview, {
    title: "カテゴリ名",
    text: "食費",
    isPlaceholder: false,
  });
});

test("getSettingsKeyboardAccessoryPreview returns formatted budget preview", () => {
  const preview = getSettingsKeyboardAccessoryPreview(
    { kind: "budget", categoryName: "食費" },
    {
      categoryName: "",
      breakdownName: "",
      accountName: "",
      accountBalance: "",
      budgetValue: "50000",
    },
  );

  assert.deepEqual(preview, {
    title: "食費の予算",
    text: "¥50,000",
    isPlaceholder: false,
  });
});

test("getSettingsKeyboardAccessoryPreview returns placeholder for empty account balance", () => {
  const preview = getSettingsKeyboardAccessoryPreview(
    { kind: "account-balance" },
    {
      categoryName: "",
      breakdownName: "",
      accountName: "",
      accountBalance: "",
      budgetValue: "",
    },
  );

  assert.deepEqual(preview, {
    title: "口座残高",
    text: "初期残高を入力",
    isPlaceholder: true,
  });
});
