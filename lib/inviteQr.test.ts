import assert from "node:assert/strict";
import test from "node:test";

import { buildInviteQrMatrix, parseScannedInviteCode } from "./inviteQr";

const SAMPLE_CODE = "ABCDEFGH23";

test("invite qr matrix is square and has both dark and light modules", () => {
  const matrix = buildInviteQrMatrix(SAMPLE_CODE);

  assert.ok(matrix.length >= 21, "QRのモジュール数は最低21以上");
  for (const row of matrix) {
    assert.equal(row.length, matrix.length);
  }

  const cells = matrix.flat();
  assert.ok(cells.some((cell) => cell === true));
  assert.ok(cells.some((cell) => cell === false));
});

test("invite qr matrix is deterministic for the same code", () => {
  assert.deepEqual(buildInviteQrMatrix(SAMPLE_CODE), buildInviteQrMatrix(SAMPLE_CODE));
});

test("scanned invite code is accepted for valid formats", () => {
  assert.equal(parseScannedInviteCode("ABCDEFGH23"), "ABCDEFGH23");
  // 旧6文字コード
  assert.equal(parseScannedInviteCode("ABC234"), "ABC234");
  // 前後空白と小文字を正規化する
  assert.equal(parseScannedInviteCode("  abcdefgh23\n"), "ABCDEFGH23");
});

test("scanned invite code rejects non invite-code payloads", () => {
  assert.equal(parseScannedInviteCode(""), null);
  assert.equal(parseScannedInviteCode("https://example.com"), null);
  // 紛らわしい文字（0/1/I/O）は招待コード文字集合に含まれない
  assert.equal(parseScannedInviteCode("ABCDEFGH01"), null);
  // 長さ不一致
  assert.equal(parseScannedInviteCode("ABCDE"), null);
  assert.equal(parseScannedInviteCode("ABCDEFGH234"), null);
});
