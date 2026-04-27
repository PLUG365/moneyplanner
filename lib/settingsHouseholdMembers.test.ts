import assert from "node:assert/strict";
import test from "node:test";

import { getMemberRemovalActionLabel } from "./settingsHouseholdMembers";

test("getMemberRemovalActionLabel distinguishes self leave from member removal", () => {
  assert.equal(getMemberRemovalActionLabel("user-1", "user-1"), "退出");
  assert.equal(getMemberRemovalActionLabel("user-1", "user-2"), "解除");
});
