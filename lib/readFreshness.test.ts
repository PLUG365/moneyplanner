import assert from "node:assert/strict";
import test from "node:test";

import {
    hasDataVersionChanged,
    shouldReadServerForScope,
} from "./readFreshness";

test("hasDataVersionChanged treats matching versions as fresh", () => {
  assert.equal(hasDataVersionChanged("v1", "v1"), false);
  assert.equal(hasDataVersionChanged(null, null), false);
});

test("hasDataVersionChanged detects marker changes", () => {
  assert.equal(hasDataVersionChanged("v1", "v2"), true);
  assert.equal(hasDataVersionChanged(null, "v2"), true);
  assert.equal(hasDataVersionChanged("v1", null), true);
});

test("shouldReadServerForScope reads server when no cached scope data exists", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: false,
      scopeVersion: "v1",
      currentDataVersion: "v1",
    }),
    true,
  );
});

test("shouldReadServerForScope skips server when cached scope matches current marker", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v1",
    }),
    false,
  );
});

test("shouldReadServerForScope reads server when cached scope is stale", () => {
  assert.equal(
    shouldReadServerForScope({
      hasCachedData: true,
      scopeVersion: "v1",
      currentDataVersion: "v2",
    }),
    true,
  );
});
