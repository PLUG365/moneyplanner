import type {
    BudgetStatus,
    MonthlyCategorySummary,
    MonthlyTotal,
    TransactionType,
} from "./firestore";

type SummaryTransaction = {
  date: string;
  amount: number;
  type: TransactionType;
  categoryId?: string | null;
  categoryName?: string;
  categoryColor?: string;
};

type BudgetSource = {
  categoryId: string;
  amount: number;
};

type CategorySource = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
};

function isInMonth(date: string, year: number, month: number): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, "0")}-`);
}

function buildCategorySummaryKey(tx: SummaryTransaction): string {
  if (tx.categoryId) return tx.categoryId;
  const snapshotName = tx.categoryName?.trim();
  return snapshotName ? `snapshot:${tx.type}:${snapshotName}` : "";
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function buildMonthCategorySummaryFromTransactions(
  transactions: SummaryTransaction[],
  year: number,
  month: number,
): MonthlyCategorySummary[] {
  const summaryMap = new Map<string, MonthlyCategorySummary>();

  for (const tx of transactions) {
    if (!isInMonth(tx.date, year, month)) continue;
    const categoryId = buildCategorySummaryKey(tx);
    const key = `${tx.type}_${categoryId}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.total += tx.amount;
      continue;
    }

    summaryMap.set(key, {
      type: tx.type,
      categoryId,
      categoryName: tx.categoryName || "未分類",
      categoryColor: tx.categoryColor || "#666666",
      total: tx.amount,
    });
  }

  return Array.from(summaryMap.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return b.total - a.total;
  });
}

export function buildBudgetStatusesFromData(input: {
  year: number;
  month: number;
  transactions: SummaryTransaction[];
  budgets: BudgetSource[];
  categories: CategorySource[];
}): BudgetStatus[] {
  const categoryMap = new Map<string, { name: string; color: string }>();
  const expenseCategoryIdByName = new Map<string, string>();
  for (const category of input.categories) {
    if (category.type === "expense") {
      categoryMap.set(category.id, {
        name: category.name,
        color: category.color,
      });
      expenseCategoryIdByName.set(normalize(category.name), category.id);
    }
  }

  const spendingMap = new Map<string, number>();
  for (const tx of input.transactions) {
    if (!isInMonth(tx.date, input.year, input.month)) continue;
    if (tx.type !== "expense") continue;
    const categoryId =
      tx.categoryId ||
      expenseCategoryIdByName.get(normalize(tx.categoryName ?? "")) ||
      "";
    spendingMap.set(categoryId, (spendingMap.get(categoryId) ?? 0) + tx.amount);
  }

  const statuses: BudgetStatus[] = [];
  for (const budget of input.budgets) {
    if (budget.amount <= 0) continue;
    const category = categoryMap.get(budget.categoryId);
    if (!category) continue;
    const spentAmount = spendingMap.get(budget.categoryId) ?? 0;
    const usageRate = spentAmount / budget.amount;

    statuses.push({
      categoryId: budget.categoryId,
      categoryName: category.name,
      categoryColor: category.color,
      budgetAmount: budget.amount,
      spentAmount,
      usageRate,
      level:
        usageRate >= 1 ? "exceeded" : usageRate >= 0.8 ? "warning" : "none",
    });
  }

  return statuses.sort((a, b) => b.usageRate - a.usageRate);
}

export function buildYearMonthlyTotalsFromTransactions(
  transactions: SummaryTransaction[],
  year: number,
): MonthlyTotal[] {
  const totals: Record<number, MonthlyTotal> = {};
  for (let month = 1; month <= 12; month++) {
    totals[month] = { month, income: 0, expense: 0 };
  }

  for (const tx of transactions) {
    if (!tx.date.startsWith(`${year}-`)) continue;
    const month = parseInt(tx.date.split("-")[1], 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    if (tx.type === "income") {
      totals[month].income += tx.amount;
    } else {
      totals[month].expense += tx.amount;
    }
  }

  return Object.values(totals);
}
