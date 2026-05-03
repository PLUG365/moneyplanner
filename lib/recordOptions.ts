import { sortCategoriesForDisplay } from "./categoryOrdering";

type RecordCategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
  isDefault: boolean;
  displayOrder?: number | null;
};

export function buildRecordCategoryOptions<T extends RecordCategoryOption>(
  categories: T[],
): T[] {
  return sortCategoriesForDisplay(categories);
}
