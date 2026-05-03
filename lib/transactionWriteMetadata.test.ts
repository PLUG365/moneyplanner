import assert from "node:assert/strict";
import test from "node:test";

import { buildTransactionWriteMetadata } from "./transactionWriteMetadata";

test("buildTransactionWriteMetadata uses selected master names for offline-safe writes", () => {
  assert.deepEqual(
    buildTransactionWriteMetadata({
      accountName: "共有財布",
      categoryName: "食費",
      categoryColor: "#C62828",
      breakdownName: "外食",
      storeName: "定食屋",
    }),
    {
      accountName: "共有財布",
      categoryName: "食費",
      categoryColor: "#C62828",
      breakdownName: "外食",
      storeName: "定食屋",
    },
  );
});

test("buildTransactionWriteMetadata fills safe fallbacks", () => {
  assert.deepEqual(buildTransactionWriteMetadata({}), {
    accountName: "家計",
    categoryName: "未分類",
    categoryColor: "#666666",
    breakdownName: "",
    storeName: "",
  });
});
