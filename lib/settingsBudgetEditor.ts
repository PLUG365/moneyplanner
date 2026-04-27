type BudgetInputSource = {
  categoryId: string;
  amount: number;
};

export function buildBudgetInputMap(
  rows: BudgetInputSource[],
): Record<string, string> {
  const inputs: Record<string, string> = {};
  rows.forEach((row) => {
    inputs[row.categoryId] = row.amount > 0 ? String(row.amount) : "";
  });
  return inputs;
}
