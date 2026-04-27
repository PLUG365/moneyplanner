import assert from "node:assert/strict";
import test from "node:test";

import {
    isActiveHouseholdMember,
    mapHouseholdMember,
} from "./householdMembership";

test("isActiveHouseholdMember rejects missing and removed member docs", () => {
  assert.equal(isActiveHouseholdMember(null), false);
  assert.equal(
    isActiveHouseholdMember({ removedAt: "2026-04-26T00:00:00Z" }),
    false,
  );
});

test("isActiveHouseholdMember accepts member docs without removedAt", () => {
  assert.equal(isActiveHouseholdMember({ displayName: "夫" }), true);
});

test("mapHouseholdMember normalizes display name and removed status", () => {
  assert.deepEqual(mapHouseholdMember("user-1", { displayName: "" }), {
    uid: "user-1",
    displayName: "メンバー",
    removed: false,
  });
  assert.deepEqual(
    mapHouseholdMember("user-2", { displayName: "妻", removedAt: 1 }),
    {
      uid: "user-2",
      displayName: "妻",
      removed: true,
    },
  );
});
