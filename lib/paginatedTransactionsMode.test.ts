import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaginatedTransactionsScopeKey,
  pickNewestDataVersion,
  shouldFetchAllTransactions,
} from "./paginatedTransactionsMode";

test("shouldFetchAllTransactions keeps normal history on paginated mode", () => {
  assert.equal(
    shouldFetchAllTransactions({
      readAll: false,
      range: { from: null, to: null },
    }),
    false,
  );
});

test("shouldFetchAllTransactions reads all for explicit search mode", () => {
  assert.equal(
    shouldFetchAllTransactions({
      readAll: true,
      range: { from: null, to: null },
    }),
    true,
  );
});

test("shouldFetchAllTransactions reads bounded date ranges completely", () => {
  assert.equal(
    shouldFetchAllTransactions({
      readAll: false,
      range: { from: "2026-05-01", to: "2026-05-31" },
    }),
    true,
  );
});

test("buildPaginatedTransactionsScopeKey separates page and all-cache scopes", () => {
  assert.equal(
    buildPaginatedTransactionsScopeKey("h1", { from: null, to: null }, false),
    "h1:transactions:history:page::",
  );
  assert.equal(
    buildPaginatedTransactionsScopeKey("h1", { from: null, to: null }, true),
    "h1:transactions:history:all::",
  );
});

test("pickNewestDataVersion keeps a newer persisted cache version over stale memory marker", () => {
  assert.equal(pickNewestDataVersion("200", "100"), "200");
  assert.equal(pickNewestDataVersion("100", "200"), "200");
  assert.equal(pickNewestDataVersion(null, "200"), "200");
  assert.equal(pickNewestDataVersion("2026-05-01T00:00:00.000Z", "2026-05-02T00:00:00.000Z"), "2026-05-02T00:00:00.000Z");
});
