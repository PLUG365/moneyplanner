import assert from "node:assert/strict";
import test from "node:test";

import {
    excludeDeletedTransactionDocs,
    isDeletedTransactionData,
} from "./transactionSoftDelete";

test("isDeletedTransactionData is true only for deleted === true", () => {
  assert.equal(isDeletedTransactionData({ deleted: true }), true);
  assert.equal(isDeletedTransactionData({ deleted: false }), false);
  assert.equal(isDeletedTransactionData({}), false);
  assert.equal(isDeletedTransactionData(null), false);
  assert.equal(isDeletedTransactionData(undefined), false);
  // 型崩れデータ（文字列やタイムスタンプ等）は削除扱いにしない
  assert.equal(isDeletedTransactionData({ deleted: "true" }), false);
  assert.equal(isDeletedTransactionData({ deleted: 1 }), false);
});

test("excludeDeletedTransactionDocs filters only soft-deleted docs", () => {
  const makeDoc = (id: string, deleted?: unknown) => ({
    id,
    data: () => (deleted === undefined ? {} : { deleted }),
  });

  const docs = [
    makeDoc("a"),
    makeDoc("b", true),
    makeDoc("c", false),
    makeDoc("d", "true"),
  ];

  const active = excludeDeletedTransactionDocs(docs);
  assert.deepEqual(
    active.map((doc) => doc.id),
    ["a", "c", "d"],
  );
});
