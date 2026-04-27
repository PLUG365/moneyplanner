import assert from "node:assert/strict";
import test from "node:test";

import { getSnapshotDataOrNull, snapshotExists } from "./firestoreSnapshot";

test("snapshotExists supports React Native Firebase exists method", () => {
  assert.equal(snapshotExists({ exists: () => true }), true);
  assert.equal(snapshotExists({ exists: () => false }), false);
});

test("snapshotExists supports boolean exists property", () => {
  assert.equal(snapshotExists({ exists: true }), true);
  assert.equal(snapshotExists({ exists: false }), false);
});

test("getSnapshotDataOrNull returns null for missing snapshots", () => {
  assert.equal(
    getSnapshotDataOrNull({ exists: () => false, data: () => undefined }),
    null,
  );
});

test("getSnapshotDataOrNull returns data for existing snapshots", () => {
  assert.deepEqual(
    getSnapshotDataOrNull({
      exists: () => true,
      data: () => ({ amount: 100 }),
    }),
    { amount: 100 },
  );
});
