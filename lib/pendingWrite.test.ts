import assert from "node:assert/strict";
import test from "node:test";

import { waitForPendingWrite } from "./pendingWrite";

test("waitForPendingWrite returns acknowledged when the write resolves before timeout", async () => {
  const result = await waitForPendingWrite(Promise.resolve("tx-1"), 20);

  assert.deepEqual(result, { status: "acknowledged", value: "tx-1" });
});

test("waitForPendingWrite returns queued when the write is still pending after timeout", async () => {
  const result = await waitForPendingWrite(new Promise<string>(() => {}), 1);

  assert.deepEqual(result, { status: "queued" });
});

test("waitForPendingWrite rejects when the write fails before timeout", async () => {
  await assert.rejects(
    waitForPendingWrite(Promise.reject(new Error("denied")), 20),
    /denied/,
  );
});
