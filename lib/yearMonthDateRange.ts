function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function fromYearMonthDate(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

export function toYearMonthDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(lastDay)}`;
}
