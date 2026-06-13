import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedImportRow } from "./csvImportParse";
import { resolveImportRows } from "./csvImportResolve";

const masters = {
  accounts: [
    { id: "default", name: "家計" },
    { id: "acc2", name: "給与口座" },
  ],
  categories: [
    { id: "cat1", name: "食費", type: "expense" as const, color: "#FF0000" },
    { id: "cat2", name: "給与", type: "income" as const, color: "#00FF00" },
  ],
  breakdowns: [
    { id: "bd1", categoryId: "cat1", name: "夕食" },
    { id: "bd2", categoryId: "cat2", name: "夕食" },
  ],
  stores: [{ id: "st1", name: "スーパーA" }],
  defaultAccountId: "default",
};

function makeRow(overrides: Partial<ParsedImportRow> = {}): ParsedImportRow {
  return {
    line: 2,
    date: "2026-04-26",
    type: "expense",
    accountName: "家計",
    categoryName: "食費",
    breakdownName: "夕食",
    storeName: "スーパーA",
    amount: 980,
    memo: "弁当",
    ...overrides,
  };
}

test("resolveImportRows links all entities on exact name match", () => {
  const [resolved] = resolveImportRows([makeRow()], masters);
  assert.equal(resolved.accountId, "default");
  assert.equal(resolved.categoryId, "cat1");
  assert.equal(resolved.breakdownId, "bd1");
  assert.equal(resolved.storeId, "st1");
  assert.equal(resolved.categoryColor, "#FF0000");
  assert.equal(resolved.amount, 980);
  assert.equal(resolved.memo, "弁当");
});

test("resolveImportRows leaves unmatched account as null with snapshot name", () => {
  const [resolved] = resolveImportRows(
    [makeRow({ accountName: "存在しない口座" })],
    masters,
  );
  assert.equal(resolved.accountId, null);
  assert.equal(resolved.accountName, "存在しない口座");
});

test("resolveImportRows leaves unmatched category as null with snapshot name", () => {
  const [resolved] = resolveImportRows(
    [makeRow({ categoryName: "趣味", breakdownName: "夕食" })],
    masters,
  );
  assert.equal(resolved.categoryId, null);
  assert.equal(resolved.categoryName, "趣味");
  assert.equal(resolved.categoryColor, null);
  assert.equal(resolved.breakdownId, null);
  assert.equal(resolved.breakdownName, "夕食");
});

test("resolveImportRows matches category by type: expense name does not match income row", () => {
  const [resolved] = resolveImportRows(
    [makeRow({ type: "income", categoryName: "食費" })],
    masters,
  );
  assert.equal(resolved.categoryId, null);
});

test("resolveImportRows scopes breakdown lookup to the matched category", () => {
  const [resolved] = resolveImportRows(
    [makeRow({ type: "income", categoryName: "給与", breakdownName: "夕食" })],
    masters,
  );
  assert.equal(resolved.categoryId, "cat2");
  assert.equal(resolved.breakdownId, "bd2");
});

test("resolveImportRows leaves unmatched store as null with snapshot name", () => {
  const [resolved] = resolveImportRows(
    [makeRow({ storeName: "新しい店" })],
    masters,
  );
  assert.equal(resolved.storeId, null);
  assert.equal(resolved.storeName, "新しい店");
});

test("resolveImportRows matches names with surrounding whitespace in masters", () => {
  const [resolved] = resolveImportRows([makeRow({ accountName: "給与口座" })], {
    ...masters,
    accounts: [{ id: "acc2", name: " 給与口座 " }],
  });
  assert.equal(resolved.accountId, "acc2");
});

test("resolveImportRows maps empty names to default account and null ids", () => {
  const [resolved] = resolveImportRows(
    [
      makeRow({
        accountName: "",
        categoryName: "",
        breakdownName: "",
        storeName: "",
      }),
    ],
    masters,
  );
  assert.equal(resolved.accountId, "default");
  assert.equal(resolved.categoryId, null);
  assert.equal(resolved.breakdownId, null);
  assert.equal(resolved.storeId, null);
  assert.equal(resolved.categoryColor, null);
});
