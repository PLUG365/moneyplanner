export type OrderedCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
  isDefault: boolean;
  displayOrder?: number | null;
};

export type CategoryMoveDirection = "up" | "down";

export function sortCategoriesForDisplay<T extends OrderedCategory>(
  categories: T[],
): T[] {
  return [...categories].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);

    const aOrder = Number.isFinite(a.displayOrder)
      ? Number(a.displayOrder)
      : Number.POSITIVE_INFINITY;
    const bOrder = Number.isFinite(b.displayOrder)
      ? Number(b.displayOrder)
      : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;

    if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
    return a.name.localeCompare(b.name, "ja-JP");
  });
}

export function moveCategoryInDisplayOrder<T extends OrderedCategory>(
  categories: T[],
  categoryId: string,
  direction: CategoryMoveDirection,
): T[] {
  const target = categories.find((category) => category.id === categoryId);
  if (!target) return categories;

  const sorted = sortCategoriesForDisplay(categories);
  const sameTypeItems = sorted.filter(
    (category) => category.type === target.type,
  );
  const currentIndex = sameTypeItems.findIndex(
    (category) => category.id === categoryId,
  );
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sameTypeItems.length) {
    return sorted;
  }

  const reorderedSameType = [...sameTypeItems];
  const [moved] = reorderedSameType.splice(currentIndex, 1);
  reorderedSameType.splice(nextIndex, 0, moved);

  const reorderedByType = new Map<string, T[]>();
  reorderedByType.set(target.type, reorderedSameType);

  return sorted.map((category) => {
    if (category.type !== target.type) return category;
    return reorderedByType.get(target.type)?.shift() ?? category;
  });
}

export function buildCategoryDisplayOrderPatch(
  categories: OrderedCategory[],
): { id: string; displayOrder: number }[] {
  return categories.map((category, index) => ({
    id: category.id,
    displayOrder: index,
  }));
}
