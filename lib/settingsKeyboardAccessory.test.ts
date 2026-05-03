import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAccountBalanceInputDisplay,
  formatYenDisplay,
  getSettingsKeyboardAccessoryPreview,
  normalizeAccountBalanceInput,
  normalizeSignedYenInput,
  resolveAccountBalanceInput,
} from "./settingsKeyboardAccessory";

test("formatYenDisplay formats raw digits as yen", () => {
  assert.equal(formatYenDisplay("123456"), "¥123,456");
  assert.equal(formatYenDisplay("-123456"), "-¥123,456");
  assert.equal(formatYenDisplay(""), "");
});

test("normalizeSignedYenInput keeps a leading minus for account balances", () => {
  assert.equal(normalizeSignedYenInput("-123456"), "-123456");
  assert.equal(normalizeSignedYenInput("¥-12,345"), "-12345");
  assert.equal(normalizeSignedYenInput("12-345"), "12345");
  assert.equal(normalizeSignedYenInput("--"), "-");
});

test("normalizeAccountBalanceInput keeps arithmetic operators", () => {
  assert.equal(normalizeAccountBalanceInput("¥12,000+3,000"), "12000+3000");
  assert.equal(normalizeAccountBalanceInput("12,000×2"), "12000*2");
  assert.equal(normalizeAccountBalanceInput("12,000÷2"), "12000/2");
  assert.equal(normalizeAccountBalanceInput("-500"), "-500");
});

test("formatAccountBalanceInputDisplay formats plain values and keeps expressions editable", () => {
  assert.equal(formatAccountBalanceInputDisplay("12000"), "¥12,000");
  assert.equal(formatAccountBalanceInputDisplay("-12000"), "-¥12,000");
  assert.equal(formatAccountBalanceInputDisplay("12000+3000"), "12000+3000");
  assert.equal(formatAccountBalanceInputDisplay("12000*2"), "12000×2");
  assert.equal(formatAccountBalanceInputDisplay("12000/2"), "12000÷2");
});

test("resolveAccountBalanceInput applies arithmetic expressions", () => {
  assert.equal(resolveAccountBalanceInput("12000+3000"), 15000);
  assert.equal(resolveAccountBalanceInput("12000-3000"), 9000);
  assert.equal(resolveAccountBalanceInput("12000*2"), 24000);
  assert.equal(resolveAccountBalanceInput("12000/2"), 6000);
  assert.equal(resolveAccountBalanceInput("-500"), -500);
  assert.equal(resolveAccountBalanceInput(""), 0);
  assert.equal(resolveAccountBalanceInput("12000/0"), null);
  assert.equal(resolveAccountBalanceInput("12000+"), null);
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
