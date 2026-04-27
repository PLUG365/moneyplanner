import assert from "node:assert/strict";
import test from "node:test";

import {
    ACCOUNT_DELETION_CONFIRMATION_TEXT,
    getHouseholdDeletionCollectionNames,
    isAccountDeletionConfirmationValid,
} from "./accountDeletion";

test("isAccountDeletionConfirmationValid requires the exact confirmation text", () => {
  assert.equal(isAccountDeletionConfirmationValid(""), false);
  assert.equal(isAccountDeletionConfirmationValid("削除"), false);
  assert.equal(
    isAccountDeletionConfirmationValid(ACCOUNT_DELETION_CONFIRMATION_TEXT),
    true,
  );
});

test("getHouseholdDeletionCollectionNames includes members last", () => {
  const names = getHouseholdDeletionCollectionNames();

  assert.equal(names.includes("transactions"), true);
  assert.equal(names.includes("categories"), true);
  assert.equal(names.includes("members"), true);
  assert.equal(names.at(-1), "members");
});
