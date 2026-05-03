import type { HistorySearchType } from "./historySearch";

type ParamValue = string | string[] | undefined;

export type HistoryDrilldownParams = {
  historyType: HistorySearchType;
  categoryName: string;
  fromDate: string;
  toDate: string;
  expandSearch: "0";
};

export type ParsedHistoryDrilldown = {
  type: HistorySearchType;
  categoryName: string;
  fromDate: string;
  toDate: string;
  expandSearch: boolean;
};

type BuildHistoryDrilldownInput = {
  type: HistorySearchType;
  categoryName: string;
  year: number;
  month: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function firstParam(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildHistoryDrilldownParams({
  type,
  categoryName,
  year,
  month,
}: BuildHistoryDrilldownInput): HistoryDrilldownParams {
  const lastDay = new Date(year, month, 0).getDate();
  const monthLabel = pad2(month);

  return {
    historyType: type,
    categoryName,
    fromDate: `${year}-${monthLabel}-01`,
    toDate: `${year}-${monthLabel}-${pad2(lastDay)}`,
    expandSearch: "0",
  };
}

export function parseHistoryDrilldownParams(params: {
  historyType?: ParamValue;
  categoryName?: ParamValue;
  fromDate?: ParamValue;
  toDate?: ParamValue;
  expandSearch?: ParamValue;
}): ParsedHistoryDrilldown | null {
  const type = firstParam(params.historyType);
  if (type !== "income" && type !== "expense") return null;

  return {
    type,
    categoryName: firstParam(params.categoryName)?.trim() ?? "",
    fromDate: firstParam(params.fromDate)?.trim() ?? "",
    toDate: firstParam(params.toDate)?.trim() ?? "",
    expandSearch: firstParam(params.expandSearch) === "1",
  };
}
