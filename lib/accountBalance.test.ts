import assert from "node:assert/strict";
import test from "node:test";

import {
    buildBalanceAdjustmentsForCreate,
    buildBalanceAdjustmentsForDelete,
    buildBalanceAdjustmentsForUpdate,
} from "@/lib/accountBalance";

test("buildBalanceAdjustmentsForCreate returns signed delta", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForCreate({
      accountId: 1,
      type: "income",
      amount: 1200,
    }),
    [{ accountId: 1, delta: 1200 }],
  );
  assert.deepEqual(
    buildBalanceAdjustmentsForCreate({
      accountId: 2,
      type: "expense",
      amount: 300,
    }),
    [{ accountId: 2, delta: -300 }],
  );
});

test("buildBalanceAdjustmentsForDelete reverts signed delta", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForDelete({
      accountId: 3,
      type: "income",
      amount: 500,
    }),
    [{ accountId: 3, delta: -500 }],
  );
  assert.deepEqual(
    buildBalanceAdjustmentsForDelete({
      accountId: 3,
      type: "expense",
      amount: 500,
    }),
    [{ accountId: 3, delta: 500 }],
  );
});

test("buildBalanceAdjustmentsForUpdate returns one merged delta on same account", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForUpdate(
      { accountId: 1, type: "expense", amount: 1000 },
      { accountId: 1, type: "expense", amount: 1200 },
    ),
    [{ accountId: 1, delta: -200 }],
  );
});

test("buildBalanceAdjustmentsForUpdate returns two deltas when account changes", () => {
  assert.deepEqual(
    buildBalanceAdjustmentsForUpdate(
      { accountId: 1, type: "expense", amount: 1000 },
      { accountId: 2, type: "income", amount: 400 },
    ),
    [
      { accountId: 1, delta: 1000 },
      { accountId: 2, delta: 400 },
    ],
  );
});
