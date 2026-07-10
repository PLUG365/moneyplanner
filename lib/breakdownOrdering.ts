export type OrderedBreakdown = {
  id: string;
  categoryId: string;
  name: string;
  isDefault: boolean;
  displayOrder?: number | null;
};

export function sortBreakdownsForDisplay<T extends OrderedBreakdown>(
  breakdowns: T[],
): T[] {
  return [...breakdowns].sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      return a.categoryId.localeCompare(b.categoryId);
    }

    const aHasOrder = Number.isFinite(a.displayOrder);
    const bHasOrder = Number.isFinite(b.displayOrder);
    if (aHasOrder && bHasOrder) {
      const orderDifference = Number(a.displayOrder) - Number(b.displayOrder);
      if (orderDifference !== 0) return orderDifference;
    } else if (aHasOrder !== bHasOrder) {
      // Keep legacy rows ahead of newly ordered rows until a reorder backfills all rows.
      return aHasOrder ? 1 : -1;
    }

    if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
    return a.name.localeCompare(b.name, "ja-JP");
  });
}

export function buildBreakdownDisplayOrderPatch(
  breakdowns: OrderedBreakdown[],
): { id: string; displayOrder: number }[] {
  return breakdowns.map((breakdown, index) => ({
    id: breakdown.id,
    displayOrder: index,
  }));
}
