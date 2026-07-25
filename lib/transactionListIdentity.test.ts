import assert from "node:assert/strict";
import { test } from "node:test";

import type { Transaction } from "./firestore";
import { areTransactionListsEquivalent } from "./transactionListIdentity";

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    date: "2026-07-25",
    amount: 1200,
    type: "expense",
    accountId: "a1",
    accountName: "家計",
    categoryId: "c1",
    categoryName: "食費",
    categoryColor: "#111111",
    breakdownId: null,
    breakdownName: "",
    storeId: null,
    storeName: "",
    memo: "",
    createdAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

test("同じ配列参照は同一と判定する", () => {
  const list = [buildTransaction()];
  assert.equal(areTransactionListsEquivalent(list, list), true);
});

test("内容が同じ別配列は同一と判定する", () => {
  assert.equal(
    areTransactionListsEquivalent([buildTransaction()], [buildTransaction()]),
    true,
  );
});

test("件数が違えば別物と判定する", () => {
  assert.equal(
    areTransactionListsEquivalent(
      [buildTransaction()],
      [buildTransaction(), buildTransaction({ id: "t2" })],
    ),
    false,
  );
});

test("金額が変わっていれば別物と判定する", () => {
  assert.equal(
    areTransactionListsEquivalent(
      [buildTransaction({ amount: 1200 })],
      [buildTransaction({ amount: 1300 })],
    ),
    false,
  );
});

test("IDが変わっていれば別物と判定する", () => {
  assert.equal(
    areTransactionListsEquivalent(
      [buildTransaction({ id: "t1" })],
      [buildTransaction({ id: "t2" })],
    ),
    false,
  );
});

test("メモだけの違いも検出する", () => {
  assert.equal(
    areTransactionListsEquivalent(
      [buildTransaction({ memo: "" })],
      [buildTransaction({ memo: "ランチ" })],
    ),
    false,
  );
});

test("null と空文字を区別する", () => {
  assert.equal(
    areTransactionListsEquivalent(
      [buildTransaction({ storeId: null })],
      [buildTransaction({ storeId: "" })],
    ),
    false,
  );
});

test("並び順が違えば別物と判定する", () => {
  const first = buildTransaction({ id: "t1", date: "2026-07-25" });
  const second = buildTransaction({ id: "t2", date: "2026-07-24" });
  assert.equal(
    areTransactionListsEquivalent([first, second], [second, first]),
    false,
  );
});

test("空配列同士は同一と判定する", () => {
  assert.equal(areTransactionListsEquivalent([], []), true);
});

test("空配列と非空は別物と判定する", () => {
  assert.equal(areTransactionListsEquivalent([], [buildTransaction()]), false);
});

test("多件数でも内容が同じなら同一と判定する", () => {
  const build = (index: number) =>
    buildTransaction({ id: `t${index}`, amount: index });
  const a = Array.from({ length: 500 }, (_, index) => build(index));
  const b = Array.from({ length: 500 }, (_, index) => build(index));
  assert.equal(areTransactionListsEquivalent(a, b), true);
});

test("多件数で1件だけ違っても検出する", () => {
  const build = (index: number) =>
    buildTransaction({ id: `t${index}`, amount: index });
  const a = Array.from({ length: 500 }, (_, index) => build(index));
  const b = Array.from({ length: 500 }, (_, index) => build(index));
  b[499] = buildTransaction({ id: "t499", amount: 99999 });
  assert.equal(areTransactionListsEquivalent(a, b), false);
});
