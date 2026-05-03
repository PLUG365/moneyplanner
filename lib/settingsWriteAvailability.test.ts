import assert from "node:assert/strict";
import test from "node:test";

import { getSettingsWriteAvailability } from "./settingsWriteAvailability";

test("getSettingsWriteAvailability disables settings writes while settings data is from cache", () => {
  assert.deepEqual(
    getSettingsWriteAvailability({ settingsDataFromCache: true }),
    {
      canWrite: false,
      reason: "offline",
    },
  );
});

test("getSettingsWriteAvailability allows settings writes with server-backed data", () => {
  assert.deepEqual(
    getSettingsWriteAvailability({ settingsDataFromCache: false }),
    {
      canWrite: true,
      reason: null,
    },
  );
});
