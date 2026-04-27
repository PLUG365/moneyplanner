type TransactionType = "income" | "expense";

type Category = {
  id?: string | number;
  name: string;
  color: string;
  type?: TransactionType;
  isDefault?: boolean;
};

type Breakdown = {
  id?: string | number;
  categoryId?: string | number;
  name: string;
  isDefault?: boolean;
};

type Account = {
  id?: string | number;
  name: string;
  balance: number;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SettingsManagerTab = "category" | "breakdown" | "account";

export type CategoryEditorDraft = {
  name: string;
  color: string;
};

export type BreakdownEditorDraft = {
  name: string;
};

export type AccountEditorDraft = {
  name: string;
  balance: string;
};

export function buildEditorMeta(
  tab: SettingsManagerTab,
  isEditing: boolean,
): { title: string; submitLabel: string } {
  const label =
    tab === "category" ? "カテゴリ" : tab === "breakdown" ? "内訳" : "口座";
  return {
    title: `${label}を${isEditing ? "編集" : "追加"}`,
    submitLabel: isEditing ? "更新" : "追加",
  };
}

export function buildEmptyCategoryEditorDraft(
  _type: TransactionType,
  defaultColor: string,
): CategoryEditorDraft {
  return {
    name: "",
    color: defaultColor,
  };
}

export function buildCategoryEditorDraft(
  category: Category,
): CategoryEditorDraft {
  return {
    name: category.name,
    color: category.color,
  };
}

export function buildEmptyBreakdownEditorDraft(): BreakdownEditorDraft {
  return { name: "" };
}

export function buildBreakdownEditorDraft(
  breakdown: Breakdown,
): BreakdownEditorDraft {
  return { name: breakdown.name };
}

export function buildEmptyAccountEditorDraft(): AccountEditorDraft {
  return {
    name: "",
    balance: "",
  };
}

export function buildAccountEditorDraft(account: Account): AccountEditorDraft {
  return {
    name: account.name,
    balance: String(account.balance),
  };
}
