import assert from "node:assert/strict";
import test from "node:test";

import { createStoredMemberProfile } from "./memberProfile";

test("createStoredMemberProfile does not persist provider display name or email", () => {
  const profile = createStoredMemberProfile({
    displayName: "山田 太郎",
    email: "taro@example.com",
  });

  assert.deepEqual(profile, { displayName: "メンバー" });
  assert.equal("email" in profile, false);
});
