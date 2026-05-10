import assert from "node:assert/strict";
import test from "node:test";

import { validateJoinDisplayName } from "./householdJoinRequestValidation";

test("validateJoinDisplayName rejects blank names", () => {
  assert.equal(
    validateJoinDisplayName("   "),
    "ニックネームを入力してください",
  );
});

test("validateJoinDisplayName rejects long names", () => {
  assert.equal(
    validateJoinDisplayName("123456789012345678901"),
    "ニックネームは20文字以内で入力してください",
  );
});

test("validateJoinDisplayName rejects reserved ambiguous names", () => {
  assert.equal(
    validateJoinDisplayName("管理者"),
    "そのニックネームは利用できません",
  );
  assert.equal(
    validateJoinDisplayName("admin"),
    "そのニックネームは利用できません",
  );
});

test("validateJoinDisplayName accepts ordinary names", () => {
  assert.equal(validateJoinDisplayName("みのる"), null);
});
