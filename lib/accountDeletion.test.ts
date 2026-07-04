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

test("getHouseholdDeletionCollectionNames covers data collections but never members", () => {
  const names = getHouseholdDeletionCollectionNames();

  assert.equal(names.includes("transactions"), true);
  assert.equal(names.includes("categories"), true);
  assert.equal(names.includes("joinRequests"), true);
  assert.equal(names.includes("meta"), true);
  // members を先行削除リストに含めると、Security Rules の activeMember 資格を
  // 途中で失い以降の削除が permission-denied になる（build 26 発見事項 #2/#3）。
  // members は世帯ドキュメントと同一バッチで最後に削除する。
  assert.equal(names.includes("members"), false);
});
