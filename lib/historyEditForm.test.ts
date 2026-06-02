import assert from "node:assert/strict";
import test from "node:test";

import {
    getHistoryEditEditorBreakdowns,
    resolveHistoryEditStoreForWrite,
} from "./historyEditForm";

test("getHistoryEditEditorBreakdowns keeps all breakdowns available for category changes", () => {
  const breakdowns = [
    { id: "bd-food", categoryId: "cat-food", name: "外食" },
    { id: "bd-daily", categoryId: "cat-daily", name: "日用品" },
  ];

  assert.deepEqual(getHistoryEditEditorBreakdowns(breakdowns), breakdowns);
});

test("resolveHistoryEditStoreForWrite keeps selected store ids", async () => {
  const result = await resolveHistoryEditStoreForWrite(
    { kind: "selected", storeId: "store-1" },
    async () => {
      throw new Error("restore should not be called for selected stores");
    },
  );

  assert.deepEqual(result, { storeId: "store-1", pendingWrite: null });
});

test("resolveHistoryEditStoreForWrite queues restored store names before saving", async () => {
  const calls: { name: string; categoryId: string }[] = [];
  const pendingWrite = Promise.resolve();

  const result = await resolveHistoryEditStoreForWrite(
    { kind: "restore", storeName: "駅前スーパー", categoryId: "cat-food" },
    async (name, categoryId) => {
      calls.push({ name, categoryId });
      return { storeId: "store-restored", pendingWrite };
    },
  );

  assert.deepEqual(result, { storeId: "store-restored", pendingWrite });
  assert.deepEqual(calls, [{ name: "駅前スーパー", categoryId: "cat-food" }]);
});

test("resolveHistoryEditStoreForWrite keeps empty store selections empty", async () => {
  const result = await resolveHistoryEditStoreForWrite(
    { kind: "none" },
    async () => {
      throw new Error("restore should not be called for empty stores");
    },
  );

  assert.deepEqual(result, { storeId: null, pendingWrite: null });
});
