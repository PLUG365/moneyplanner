type DisplayNameInput = {
  categoryName: string | null | undefined;
  breakdownName: string | null | undefined;
};

type BreakdownChoice = {
  id: string | number;
  categoryId?: string | number | null;
};

type NamedBreakdownChoice = BreakdownChoice & {
  name?: string;
};

export function buildCategoryDisplayName({
  categoryName,
  breakdownName,
}: DisplayNameInput): string {
  if (!categoryName) return "カテゴリを選択";
  return breakdownName ? `${categoryName} - ${breakdownName}` : categoryName;
}

export function shouldShowBreakdownChoicesInEditor(
  categoryId: string | number | null,
  breakdowns: BreakdownChoice[],
): boolean {
  void categoryId;
  void breakdowns;
  return false;
}

export function getCategoryModalNextStep(
  breakdownCount: number,
): "close" | "breakdown" {
  return breakdownCount > 0 ? "breakdown" : "close";
}

export function getBreakdownChoicesForCategory<T extends NamedBreakdownChoice>(
  categoryId: string | number | null,
  breakdowns: T[],
): T[] {
  if (categoryId == null) return [];
  return breakdowns.filter((item) => item.categoryId === categoryId);
}
