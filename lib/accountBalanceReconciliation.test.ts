import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountBalanceReconciliation } from "./accountBalanceReconciliation";

test("buildAccountBalanceReconciliation initializes missing initial balances without changing current balance", () => {
  const result = buildAccountBalanceReconciliation(
    [{ id: "wallet", balance: 7000, initialBalance: null }],
    [
      { accountId: "wallet", type: "income", amount: 10000 },
      { accountId: "wallet", type: "expense", amount: 3000 },
    ],
  );

  assert.deepEqual(result, [
    {
      accountId: "wallet",
      initialBalance: 0,
      balance: 7000,
      initializeInitialBalance: true,
      updateBalance: false,
    },
  ]);
});

test("buildAccountBalanceReconciliation corrects balances from initial balance and final transactions", () => {
  const result = buildAccountBalanceReconciliation(
    [{ id: "wallet", balance: 6500, initialBalance: 0 }],
    [
      { accountId: "wallet", type: "income", amount: 10000 },
      { accountId: "wallet", type: "expense", amount: 3000 },
    ],
  );

  assert.deepEqual(result, [
    {
      accountId: "wallet",
      initialBalance: 0,
      balance: 7000,
      initializeInitialBalance: false,
      updateBalance: true,
    },
  ]);
});

test("buildAccountBalanceReconciliation ignores accounts that are already consistent", () => {
  const result = buildAccountBalanceReconciliation(
    [{ id: "wallet", balance: 7000, initialBalance: 0 }],
    [
      { accountId: "wallet", type: "income", amount: 10000 },
      { accountId: "wallet", type: "expense", amount: 3000 },
    ],
  );

  assert.deepEqual(result, []);
});

test("buildAccountBalanceReconciliation treats missing transaction account as default", () => {
  const result = buildAccountBalanceReconciliation(
    [{ id: "default", balance: -1000, initialBalance: 0 }],
    [{ accountId: null, type: "expense", amount: 1000 }],
    "default",
  );

  assert.deepEqual(result, []);
});
