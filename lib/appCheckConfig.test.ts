import assert from "node:assert/strict";
import test from "node:test";

import { buildAppCheckProviderOptions } from "./appCheckConfig";

test("buildAppCheckProviderOptions uses debug providers in development", () => {
  assert.deepEqual(buildAppCheckProviderOptions(true, "debug-token"), {
    android: { provider: "debug", debugToken: "debug-token" },
    apple: { provider: "debug", debugToken: "debug-token" },
  });
});

test("buildAppCheckProviderOptions uses production attestation providers outside development", () => {
  assert.deepEqual(buildAppCheckProviderOptions(false), {
    android: { provider: "playIntegrity" },
    apple: { provider: "appAttestWithDeviceCheckFallback" },
  });
});

test("buildAppCheckProviderOptions omits blank debug token", () => {
  assert.deepEqual(buildAppCheckProviderOptions(true, "   "), {
    android: { provider: "debug" },
    apple: { provider: "debug" },
  });
});
