import assert from "node:assert/strict";
import test from "node:test";

import {
    formatYearMonthLabel,
    fromYearMonthDate,
    shiftYearMonth,
    toYearMonthDate,
} from "./monthPicker";

test("toYearMonthDate converts a year and month to a local date", () => {
  assert.equal(toYearMonthDate(2026, 5).getFullYear(), 2026);
  assert.equal(toYearMonthDate(2026, 5).getMonth(), 4);
  assert.equal(toYearMonthDate(2026, 5).getDate(), 1);
});

test("fromYearMonthDate extracts year and month from a selected date", () => {
  assert.deepEqual(fromYearMonthDate(new Date(2026, 10, 23)), {
    year: 2026,
    month: 11,
  });
});

test("shiftYearMonth crosses year boundaries", () => {
  assert.deepEqual(shiftYearMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftYearMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftYearMonth(2026, 5, 2), { year: 2026, month: 7 });
});

test("formatYearMonthLabel formats monthly and yearly labels", () => {
  assert.equal(formatYearMonthLabel(2026, 5, "monthly"), "2026年5月");
  assert.equal(formatYearMonthLabel(2026, 5, "yearly"), "2026年");
});
