import { DEFAULT_ASSUMPTIONS } from "@/lib/simulation/assumptions";

export type SimulationInput = {
  startYear: number;
  years: number;
  initialBalance: number;
  annualIncome: number;
  annualExpense: number;
  extraIncomeByYear?: Record<number, number>;
  extraExpensesByYear?: Record<number, number>;
  assumptions?: Partial<typeof DEFAULT_ASSUMPTIONS>;
};

export type ProjectionRow = {
  year: number;
  openingBalance: number;
  income: number;
  expense: number;
  netCashFlow: number;
  investmentGain: number;
  closingBalance: number;
};

function normalizeRate(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

export function runSimulation(input: SimulationInput): ProjectionRow[] {
  const years = Math.max(1, Math.floor(input.years));
  const assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    ...(input.assumptions ?? {}),
  };

  const incomeGrowthRate = normalizeRate(
    assumptions.incomeGrowthRate,
    DEFAULT_ASSUMPTIONS.incomeGrowthRate,
  );
  const expenseInflationRate = normalizeRate(
    assumptions.expenseInflationRate,
    DEFAULT_ASSUMPTIONS.expenseInflationRate,
  );
  const assetReturnRate = normalizeRate(
    assumptions.assetReturnRate,
    DEFAULT_ASSUMPTIONS.assetReturnRate,
  );

  const rows: ProjectionRow[] = [];
  let currentBalance = Math.max(0, input.initialBalance);
  const extraIncomeByYear = input.extraIncomeByYear ?? {};
  const extraExpensesByYear = input.extraExpensesByYear ?? {};

  for (let i = 0; i < years; i += 1) {
    const year = input.startYear + i;
    const baseIncome =
      Math.max(0, input.annualIncome) * (1 + incomeGrowthRate) ** i;
    const eventIncomeRaw = extraIncomeByYear[year] ?? 0;
    const eventIncome = Number.isFinite(eventIncomeRaw) ? eventIncomeRaw : 0;
    const income = baseIncome + eventIncome;
    const baseExpense =
      Math.max(0, input.annualExpense) * (1 + expenseInflationRate) ** i;
    const eventExpenseRaw = extraExpensesByYear[year] ?? 0;
    const eventExpense = Number.isFinite(eventExpenseRaw) ? eventExpenseRaw : 0;
    const expense = baseExpense + eventExpense;

    const openingBalance = currentBalance;
    const netCashFlow = income - expense;
    const preReturnBalance = openingBalance + netCashFlow;
    const investmentGain = preReturnBalance * assetReturnRate;
    const closingBalance = preReturnBalance + investmentGain;

    rows.push({
      year,
      openingBalance,
      income,
      expense,
      netCashFlow,
      investmentGain,
      closingBalance,
    });

    currentBalance = closingBalance;
  }

  return rows;
}
