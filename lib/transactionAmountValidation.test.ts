import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  isValidTransactionAmount,
  MAX_TRANSACTION_AMOUNT,
} from "./transactionAmountValidation";

test("isValidTransactionAmount allows zero only when memo is present", () => {
  assert.equal(isValidTransactionAmount(100, ""), true);
  assert.equal(isValidTransactionAmount(0, "調整メモ"), true);
  assert.equal(isValidTransactionAmount(0, "  "), false);
  assert.equal(isValidTransactionAmount(-100, "調整メモ"), false);
  assert.equal(isValidTransactionAmount(null, "調整メモ"), false);
});

test("isValidTransactionAmount rejects amounts above MAX_TRANSACTION_AMOUNT", () => {
  assert.equal(isValidTransactionAmount(MAX_TRANSACTION_AMOUNT, ""), true);
  assert.equal(isValidTransactionAmount(MAX_TRANSACTION_AMOUNT + 1, ""), false);
});
