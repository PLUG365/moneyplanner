import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HISTORY_DISPLAY_PREFERENCE,
  parseHistoryDisplayPreference,
  serializeHistoryDisplayPreference,
} from "./historyDisplayPreferenceFormat";

test("future transactions are hidden until the user opts in", () => {
  assert.equal(DEFAULT_HISTORY_DISPLAY_PREFERENCE.showFutureTransactions, false);
});

test("parseHistoryDisplayPreference round-trips a saved preference", () => {
  const raw = serializeHistoryDisplayPreference({
    showFutureTransactions: true,
  });
  assert.deepEqual(parseHistoryDisplayPreference(raw), {
    showFutureTransactions: true,
  });
});

test("parseHistoryDisplayPreference treats unusable files as unset", () => {
  assert.equal(parseHistoryDisplayPreference(null), null);
  assert.equal(parseHistoryDisplayPreference(""), null);
  assert.equal(parseHistoryDisplayPreference("{"), null);
  assert.equal(parseHistoryDisplayPreference("{}"), null);
  assert.equal(
    parseHistoryDisplayPreference('{"showFutureTransactions":"yes"}'),
    null,
  );
});
