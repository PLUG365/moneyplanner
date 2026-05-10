import assert from "node:assert/strict";
import test from "node:test";

import { fromYearMonthDate, toYearMonthDate } from "./yearMonthDateRange";

test("fromYearMonthDate returns first day string", () => {
  assert.equal(fromYearMonthDate(2026, 5), "2026-05-01");
});

test("toYearMonthDate returns end of month for 31-day month", () => {
  assert.equal(toYearMonthDate(2026, 5), "2026-05-31");
});

test("toYearMonthDate handles leap year February", () => {
  assert.equal(toYearMonthDate(2024, 2), "2024-02-29");
});

test("toYearMonthDate handles non-leap year February", () => {
  assert.equal(toYearMonthDate(2025, 2), "2025-02-28");
});
