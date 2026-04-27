import assert from "node:assert/strict";
import test from "node:test";

import { waitForAppCheckReadiness } from "./appCheckReadiness";

test("waitForAppCheckReadiness returns ready when App Check initialization succeeds", async () => {
  const result = await waitForAppCheckReadiness(() => Promise.resolve());

  assert.deepEqual(result, { ready: true, error: null });
});

test("waitForAppCheckReadiness returns ready even when App Check initialization fails", async () => {
  const error = new Error("App Check is not configured yet");

  const result = await waitForAppCheckReadiness(() => Promise.reject(error));

  assert.equal(result.ready, true);
  assert.equal(result.error, error);
});
