import type { TransactionType } from "./firestore";

type RelinkSource = {
  type: TransactionType;
  categoryName: string;
  breakdownName: string;
};

type RelinkCategory = {
  id: string;
  name: string;
  type: TransactionType;
};

type RelinkBreakdown = {
  id: string;
  categoryId: string;
  name: string;
};

type RelinkContext = {
  categories: RelinkCategory[];
  breakdownsByCategory: Map<string, RelinkBreakdown[]>;
};

type StoreRestoreSource = {
  transactionId: string;
  type: TransactionType;
  storeName: string;
  categoryId: string | null;
};

type StoreRestorePlan = {
  stores: { key: string; name: string; categoryId: string | null }[];
  transactionStoreKeys: Map<string, string>;
  usages: { storeKey: string; categoryId: string }[];
};

type BudgetRestoreSource = {
  categoryId: string;
  amount: number;
};

export type TransactionMasterRelinkPatch = {
  categoryId: string | null;
  breakdownId: string | null;
  storeId: string | null;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function buildTransactionMasterRelinkPatch(
  source: RelinkSource,
  context: RelinkContext,
): TransactionMasterRelinkPatch {
  const category = context.categories.find(
    (candidate) =>
      candidate.type === source.type &&
      normalize(candidate.name) === normalize(source.categoryName),
  );

  if (!category) {
    return { categoryId: null, breakdownId: null, storeId: null };
  }

  const breakdown = source.breakdownName.trim()
    ? (context.breakdownsByCategory.get(category.id) ?? []).find(
        (candidate) =>
          normalize(candidate.name) === normalize(source.breakdownName),
      )
    : undefined;

  return {
    categoryId: category.id,
    breakdownId: breakdown?.id ?? null,
    storeId: null,
  };
}

export function buildStoreMasterRestorePlan(
  sources: StoreRestoreSource[],
): StoreRestorePlan {
  const storesByKey = new Map<
    string,
    { key: string; name: string; categoryId: string | null }
  >();
  const transactionStoreKeys = new Map<string, string>();
  const usageKeys = new Set<string>();
  const usages: { storeKey: string; categoryId: string }[] = [];

  for (const source of sources) {
    if (source.type !== "expense") continue;

    const name = source.storeName.trim();
    if (!name) continue;

    const key = normalize(name);
    const existing = storesByKey.get(key);
    if (!existing) {
      storesByKey.set(key, {
        key,
        name,
        categoryId: source.categoryId,
      });
    } else if (existing.categoryId == null && source.categoryId != null) {
      existing.categoryId = source.categoryId;
    }

    transactionStoreKeys.set(source.transactionId, key);

    if (source.categoryId) {
      const usageKey = `${key}_${source.categoryId}`;
      if (!usageKeys.has(usageKey)) {
        usageKeys.add(usageKey);
        usages.push({ storeKey: key, categoryId: source.categoryId });
      }
    }
  }

  return {
    stores: Array.from(storesByKey.values()),
    transactionStoreKeys,
    usages,
  };
}

export function buildBudgetMasterRestorePlan(
  budgets: BudgetRestoreSource[],
  oldCategories: RelinkCategory[],
  newCategories: RelinkCategory[],
): BudgetRestoreSource[] {
  const oldCategoryById = new Map(
    oldCategories.map((category) => [category.id, category]),
  );

  return budgets.flatMap((budget) => {
    const oldCategory = oldCategoryById.get(budget.categoryId);
    if (!oldCategory || oldCategory.type !== "expense") return [];

    const newCategory = newCategories.find(
      (candidate) =>
        candidate.type === oldCategory.type &&
        normalize(candidate.name) === normalize(oldCategory.name),
    );

    return newCategory
      ? [{ categoryId: newCategory.id, amount: budget.amount }]
      : [];
  });
}
