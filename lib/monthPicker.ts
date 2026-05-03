export type PeriodViewMode = "monthly" | "yearly";

export type YearMonth = {
  year: number;
  month: number;
};

export function toYearMonthDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

export function fromYearMonthDate(date: Date): YearMonth {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number,
): YearMonth {
  const next = new Date(year, month - 1 + deltaMonths, 1);
  return fromYearMonthDate(next);
}

export function formatYearMonthLabel(
  year: number,
  month: number,
  mode: PeriodViewMode,
): string {
  return mode === "monthly" ? `${year}年${month}月` : `${year}年`;
}
