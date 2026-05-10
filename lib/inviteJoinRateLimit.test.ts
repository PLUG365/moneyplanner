import assert from "node:assert/strict";
import test from "node:test";

import {
    buildInviteJoinFailurePatch,
    buildInviteJoinResetPatch,
    getInviteJoinCooldownRemainingMs,
    isInviteJoinCooldownActive,
    parseInviteJoinAttemptState,
} from "./inviteJoinRateLimit";

test("parseInviteJoinAttemptState normalizes invalid values", () => {
  assert.deepEqual(
    parseInviteJoinAttemptState({
      inviteJoinFailedAttempts: "not-number",
      inviteJoinCooldownUntil: null,
    }),
    {
      failedAttempts: 0,
      cooldownUntilMs: null,
    },
  );
});

test("isInviteJoinCooldownActive returns true while cooldown remains", () => {
  const nowMs = Date.parse("2026-05-10T00:00:00.000Z");
  const state = parseInviteJoinAttemptState({
    inviteJoinFailedAttempts: 1,
    inviteJoinCooldownUntil: "2026-05-10T00:05:00.000Z",
  });
  assert.equal(isInviteJoinCooldownActive(state, nowMs), true);
  assert.equal(getInviteJoinCooldownRemainingMs(state, nowMs), 5 * 60 * 1000);
});

test("buildInviteJoinFailurePatch increments failed attempts before threshold", () => {
  const patch = buildInviteJoinFailurePatch(
    { failedAttempts: 3, cooldownUntilMs: null },
    new Date("2026-05-10T00:00:00.000Z"),
  );

  assert.equal(patch.failedAttempts, 4);
  assert.equal(patch.cooldownUntil, null);
});

test("buildInviteJoinFailurePatch starts cooldown at threshold", () => {
  const patch = buildInviteJoinFailurePatch(
    { failedAttempts: 4, cooldownUntilMs: null },
    new Date("2026-05-10T00:00:00.000Z"),
  );

  assert.equal(patch.failedAttempts, 0);
  assert.equal(patch.cooldownUntil?.toISOString(), "2026-05-10T00:10:00.000Z");
});

test("buildInviteJoinResetPatch clears failure tracking", () => {
  assert.deepEqual(buildInviteJoinResetPatch(), {
    failedAttempts: 0,
    cooldownUntil: null,
  });
});
