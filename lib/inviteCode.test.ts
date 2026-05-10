import assert from "node:assert/strict";
import test from "node:test";

import {
    buildInviteCodeExpiryDate,
    createInviteCode,
    createReplacementInviteCode,
    isInviteCodeFormat,
    resolveInviteCodeState,
} from "./inviteCode";

test("createInviteCode returns a six-character code without ambiguous characters", () => {
  const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
  const code = createInviteCode(() => values.shift() ?? 0);

  assert.equal(code.length, 6);
  assert.equal(isInviteCodeFormat(code), true);
  assert.doesNotMatch(code, /[01IO]/);
});

test("isInviteCodeFormat rejects lowercase and ambiguous characters", () => {
  assert.equal(isInviteCodeFormat("ABC234"), true);
  assert.equal(isInviteCodeFormat("abc234"), false);
  assert.equal(isInviteCodeFormat("ABO234"), false);
  assert.equal(isInviteCodeFormat("AB1234"), false);
  assert.equal(isInviteCodeFormat("ABCD23X"), false);
});

test("createReplacementInviteCode retries when the generated code matches the previous code", () => {
  const codes = ["ABC234", "DEF567"];

  assert.equal(
    createReplacementInviteCode("ABC234", () => codes.shift() ?? "ZZZ999"),
    "DEF567",
  );
});

test("buildInviteCodeExpiryDate returns date with default expiry days", () => {
  const result = buildInviteCodeExpiryDate(
    new Date("2026-05-10T00:00:00.000Z"),
  );
  assert.equal(result.toISOString(), "2026-06-09T00:00:00.000Z");
});

test("resolveInviteCodeState returns disabled when disabledAt exists", () => {
  assert.equal(
    resolveInviteCodeState(
      {
        disabledAt: new Date("2026-05-10T12:00:00.000Z"),
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      Date.parse("2026-05-10T13:00:00.000Z"),
    ),
    "disabled",
  );
});

test("resolveInviteCodeState returns expired when expiresAt is past", () => {
  assert.equal(
    resolveInviteCodeState(
      {
        expiresAt: { toMillis: () => Date.parse("2026-05-10T00:00:00.000Z") },
      },
      Date.parse("2026-05-10T00:00:01.000Z"),
    ),
    "expired",
  );
});

test("resolveInviteCodeState returns active when not expired and not disabled", () => {
  assert.equal(
    resolveInviteCodeState(
      {
        expiresAt: "2026-05-11T00:00:00.000Z",
      },
      Date.parse("2026-05-10T00:00:00.000Z"),
    ),
    "active",
  );
});
