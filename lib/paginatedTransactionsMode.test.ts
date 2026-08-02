import assert from "node:assert/strict";
import test from "node:test";

import {
    buildPaginatedTransactionsScopeKey,
    HISTORY_CACHE_WINDOW_MONTHS,
    monthsAgoDateString,
    pickNewestDataVersion,
    shouldFetchAllTransactions,
} from "./paginatedTransactionsMode";

test("monthsAgoDateString は同じ年の中で月を戻す", () => {
  assert.equal(monthsAgoDateString(new Date(2026, 6, 26), 3), "2026-04-26");
});

test("monthsAgoDateString は年をまたいで戻せる", () => {
  assert.equal(monthsAgoDateString(new Date(2026, 1, 15), 3), "2025-11-15");
  assert.equal(monthsAgoDateString(new Date(2026, 6, 26), 12), "2025-07-26");
  assert.equal(monthsAgoDateString(new Date(2026, 6, 26), 36), "2023-07-26");
});

test("monthsAgoDateString は月末日でも文字列として妥当な日付を返す", () => {
  // 3月31日の1ヶ月前は2月末を超えるため繰り上がる。下限としては狭くなる方向で、
  // 足りなければ次の窓へ広げるので安全側。
  const result = monthsAgoDateString(new Date(2026, 2, 31), 1);
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(result < "2026-03-31");
});

test("monthsAgoDateString はゼロ埋めした形式を返す", () => {
  assert.equal(monthsAgoDateString(new Date(2026, 9, 5), 1), "2026-09-05");
});

test("履歴キャッシュの窓は新しい順で、最後は下限なし", () => {
  const windows = [...HISTORY_CACHE_WINDOW_MONTHS];
  assert.equal(windows[windows.length - 1], null);
  const months = windows.slice(0, -1) as number[];
  for (let i = 1; i < months.length; i += 1) {
    assert.ok(months[i] > months[i - 1], "窓は段階的に広がること");
  }
});

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
  assert.equal(
    pickNewestDataVersion(
      "2026-05-01T00:00:00.000Z",
      "2026-05-02T00:00:00.000Z",
    ),
    "2026-05-02T00:00:00.000Z",
  );
});
