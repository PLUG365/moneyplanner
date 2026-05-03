import { strict as assert } from "node:assert";
import { test } from "node:test";

import { isValidTransactionAmount } from "./transactionAmountValidation";

test("isValidTransactionAmount allows zero only when memo is present", () => {
  assert.equal(isValidTransactionAmount(100, ""), true);
  assert.equal(isValidTransactionAmount(0, "調整メモ"), true);
  assert.equal(isValidTransactionAmount(0, "  "), false);
  assert.equal(isValidTransactionAmount(-100, "調整メモ"), false);
  assert.equal(isValidTransactionAmount(null, "調整メモ"), false);
});
