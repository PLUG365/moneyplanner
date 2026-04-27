import assert from "node:assert/strict";
import test from "node:test";

import {
    createInviteCode,
    createReplacementInviteCode,
    isInviteCodeFormat,
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
