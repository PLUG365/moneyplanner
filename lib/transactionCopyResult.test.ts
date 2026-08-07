import assert from "node:assert/strict";
import test from "node:test";

import { buildBulkCopyAlert } from "./transactionCopyResult";

const base = {
  copied: 0,
  failed: 0,
  skipped: 0,
  accountFallback: 0,
  categoryFallback: 0,
};

test("buildBulkCopyAlert reports a plain success", () => {
  assert.deepEqual(buildBulkCopyAlert({ ...base, copied: 3 }), {
    title: "一括コピー完了",
    message: "3件コピーしました",
  });
});

test("buildBulkCopyAlert tells which records kept their deleted master names", () => {
  assert.deepEqual(
    buildBulkCopyAlert({
      ...base,
      copied: 3,
      accountFallback: 1,
      categoryFallback: 2,
    }),
    {
      title: "一括コピー完了",
      message: [
        "3件コピーしました",
        "口座が存在しない1件は既定口座で登録されました。",
        "カテゴリが存在しない2件は元のカテゴリ名のまま登録されました。",
      ].join("\n"),
    },
  );
});

test("buildBulkCopyAlert counts uncopied records once", () => {
  assert.deepEqual(buildBulkCopyAlert({ ...base, copied: 2, failed: 1 }), {
    title: "一括コピー完了",
    message: "2件コピーしました（1件未コピー）",
  });
  assert.deepEqual(buildBulkCopyAlert({ ...base, copied: 2, skipped: 1 }), {
    title: "一括コピー完了",
    message: "2件コピーしました（1件未コピー）",
  });
});

test("buildBulkCopyAlert stays silent when the uncopied modal already explains it", () => {
  assert.equal(buildBulkCopyAlert({ ...base, failed: 2 }), null);
});

test("buildBulkCopyAlert reports when nothing was targeted", () => {
  assert.deepEqual(buildBulkCopyAlert({ ...base, skipped: 2 }), {
    title: "コピーできませんでした",
    message: "コピー対象が見つかりません",
  });
});
