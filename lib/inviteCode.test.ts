import assert from "node:assert/strict";
import test from "node:test";

import {
    buildInviteCodeExpiryDate,
    createInviteCode,
    createReplacementInviteCode,
    isInviteCodeFormat,
    resolveInviteCodeState,
} from "./inviteCode";

test("createInviteCode returns a ten-character code without ambiguous characters", () => {
  const code = createInviteCode((byteCount) => {
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      bytes[i] = i * 7;
    }
    return bytes;
  });

  assert.equal(code.length, 10);
  assert.equal(isInviteCodeFormat(code), true);
  assert.doesNotMatch(code, /[01IO]/);
});

test("createInviteCode maps bytes without modulo bias (32 chars divides 256)", () => {
  const code = createInviteCode((byteCount) => {
    const bytes = new Uint8Array(byteCount);
    bytes.fill(255);
    return bytes;
  });

  // 255 % 32 = 31 → 末尾文字 "9"
  assert.equal(code, "9999999999");
});

test("isInviteCodeFormat accepts legacy 6-character and new 10-character codes", () => {
  assert.equal(isInviteCodeFormat("ABC234"), true);
  assert.equal(isInviteCodeFormat("ABC234DEF5"), true);
  assert.equal(isInviteCodeFormat("ABC234D"), false);
  assert.equal(isInviteCodeFormat("ABC234DEF56"), false);
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
