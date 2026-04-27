import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBalanceAdjustmentsForCreate,
    buildBalanceAdjustmentsForDelete,
    buildBalanceAdjustmentsForUpdate,
} from "./transactionBalance";

test("buildBalanceAdjustmentsForCreate returns signed account delta", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForCreate({
      accountId: "wallet",
      type: "income",
      amount: 1200,
    }),
    [{ accountId: "wallet", delta: 1200 }],
  );
  assert.deepEqual(
    buildBalanceAdjustmentsForCreate({
      accountId: "cash",
      type: "expense",
      amount: 300,
    }),
    [{ accountId: "cash", delta: -300 }],
  );
});

test("buildBalanceAdjustmentsForDelete reverts the original signed delta", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForDelete({
      accountId: "wallet",
      type: "income",
      amount: 500,
    }),
    [{ accountId: "wallet", delta: -500 }],
  );
  assert.deepEqual(
    buildBalanceAdjustmentsForDelete({
      accountId: "wallet",
      type: "expense",
      amount: 500,
    }),
    [{ accountId: "wallet", delta: 500 }],
  );
});

test("buildBalanceAdjustmentsForUpdate merges deltas on the same account", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForUpdate(
      { accountId: "wallet", type: "expense", amount: 1000 },
      { accountId: "wallet", type: "expense", amount: 1200 },
    ),
    [{ accountId: "wallet", delta: -200 }],
  );
});

test("buildBalanceAdjustmentsForUpdate returns separate deltas when account changes", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForUpdate(
      { accountId: "wallet", type: "expense", amount: 1000 },
      { accountId: "bank", type: "income", amount: 400 },
    ),
    [
      { accountId: "wallet", delta: 1000 },
      { accountId: "bank", delta: 400 },
    ],
  );
});

test("buildBalanceAdjustmentsForUpdate drops zero-sum adjustments", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForUpdate(
      { accountId: "wallet", type: "income", amount: 1000 },
      { accountId: "wallet", type: "income", amount: 1000 },
    ),
    [],
  );
});
