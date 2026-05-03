import assert from "node:assert/strict";
import test from "node:test";

import { buildHistoryListTransactions } from "./historyList";

test("buildHistoryListTransactions sorts all transactions by date and creation time descending", () => {
  const transactions = buildHistoryListTransactions([
    { id: "old", date: "2026-04-30", createdAt: "2026-04-30T10:00:00.000Z" },
    {
      id: "latest-second",
      date: "2026-05-02",
      createdAt: "2026-05-02T09:00:00.000Z",
    },
    {
      id: "latest-first",
      date: "2026-05-02",
      createdAt: "2026-05-02T12:00:00.000Z",
    },
    { id: "middle", date: "2026-05-01", createdAt: "2026-05-01T08:00:00.000Z" },
  ]);

  assert.deepEqual(
    transactions.map((tx) => tx.id),
    ["latest-first", "latest-second", "middle", "old"],
  );
});

test("buildHistoryListTransactions does not mutate the source array", () => {
  const source = [
    { id: "a", date: "2026-05-01", createdAt: "2026-05-01T08:00:00.000Z" },
    { id: "b", date: "2026-05-02", createdAt: "2026-05-02T08:00:00.000Z" },
  ];

  buildHistoryListTransactions(source);

  assert.deepEqual(
    source.map((tx) => tx.id),
    ["a", "b"],
  );
});
