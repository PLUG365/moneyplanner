import assert from "node:assert/strict";
import test from "node:test";

import { buildFirestoreQueryKey } from "./firestoreSubscription";

test("buildFirestoreQueryKey returns null until household id is known", () => {
  assert.equal(buildFirestoreQueryKey(null, "accounts"), null);
  assert.equal(buildFirestoreQueryKey("", "accounts"), null);
});

test("buildFirestoreQueryKey includes household, collection, and scope", () => {
  assert.equal(
    buildFirestoreQueryKey("household-1", "transactions", "2026-04"),
    "household-1:transactions:2026-04",
  );
});
