import assert from "node:assert/strict";
import test from "node:test";

import { mergeTransactionCacheItems } from "./transactionCacheMerge";

const baseItems = [
  { id: "new", date: "2026-05-03", createdAt: "2026-05-03T00:00:00.000Z" },
  { id: "old", date: "2026-05-01", createdAt: "2026-05-01T00:00:00.000Z" },
  { id: "deleted", date: "2026-04-30", createdAt: "2026-04-30T00:00:00.000Z" },
];

test("mergeTransactionCacheItems replaces changed items, removes deleted ids, and keeps date order", () => {
  const merged = mergeTransactionCacheItems(
    baseItems,
    [
      {
        id: "old",
        date: "2026-05-04",
        createdAt: "2026-05-04T00:00:00.000Z",
      },
      {
        id: "added",
        date: "2026-05-02",
        createdAt: "2026-05-02T00:00:00.000Z",
      },
    ],
    new Set(["deleted"]),
  );

  assert.deepEqual(
    merged.map((tx) => tx.id),
    ["old", "new", "added"],
  );
});
