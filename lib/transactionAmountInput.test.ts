import assert from "node:assert/strict";
import test from "node:test";

import {
    formatTransactionAmountInputDisplay,
    normalizeTransactionAmountInput,
    resolveTransactionAmountInput,
} from "./transactionAmountInput";

test("normalizeTransactionAmountInput keeps arithmetic operators for record amounts", () => {
  assert.equal(normalizeTransactionAmountInput("¥12,345"), "12345");
  assert.equal(normalizeTransactionAmountInput("12,000×2"), "12000*2");
  assert.equal(normalizeTransactionAmountInput("12,000÷2"), "12000/2");
  assert.equal(normalizeTransactionAmountInput("12,000+3,000"), "12000+3000");
});

test("formatTransactionAmountInputDisplay formats values and keeps expressions editable", () => {
  assert.equal(formatTransactionAmountInputDisplay("12345"), "¥12,345");
  assert.equal(formatTransactionAmountInputDisplay("12000*2"), "12000×2");
  assert.equal(formatTransactionAmountInputDisplay("12000/2"), "12000÷2");
  assert.equal(formatTransactionAmountInputDisplay(""), "");
});

test("resolveTransactionAmountInput applies arithmetic expressions", () => {
  assert.equal(resolveTransactionAmountInput("12000+3000"), 15000);
  assert.equal(resolveTransactionAmountInput("12000-3000"), 9000);
  assert.equal(resolveTransactionAmountInput("12000*2"), 24000);
  assert.equal(resolveTransactionAmountInput("12000/2"), 6000);
  assert.equal(resolveTransactionAmountInput(""), null);
  assert.equal(resolveTransactionAmountInput("12000/0"), null);
  assert.equal(resolveTransactionAmountInput("12000+"), null);
});
