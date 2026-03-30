import assert from "node:assert/strict";
import test from "node:test";

import {
    PUBLIC_DEFAULTS_UPDATED_AT,
    PUBLIC_DEFAULTS_VERSION,
    isPublicDefaultsUpdateDue,
} from "@/lib/simulation/publicDefaults";

test("public defaults metadata is exposed", () => {
  assert.equal(PUBLIC_DEFAULTS_VERSION.length > 0, true);
  assert.match(PUBLIC_DEFAULTS_UPDATED_AT, /^\d{4}-\d{2}-\d{2}$/);
});

test("isPublicDefaultsUpdateDue returns false before one year", () => {
  const referenceDate = new Date("2026-03-30");
  assert.equal(isPublicDefaultsUpdateDue(referenceDate), false);
});

test("isPublicDefaultsUpdateDue returns true after one year", () => {
  const referenceDate = new Date("2027-04-01");
  assert.equal(isPublicDefaultsUpdateDue(referenceDate), true);
});
