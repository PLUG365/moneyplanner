export type SettingsKeyboardField =
  | { kind: "category-name" }
  | { kind: "breakdown-name" }
  | { kind: "account-name" }
  | { kind: "account-balance" }
  | { kind: "budget"; categoryName: string }
  | null;

type SettingsKeyboardAccessoryInputs = {
  categoryName: string;
  breakdownName: string;
  accountName: string;
  accountBalance: string;
  budgetValue: string;
};

export function formatYenDisplay(rawDigits: string): string {
  if (!rawDigits) return "";
  const amount = parseInt(rawDigits, 10);
  if (Number.isNaN(amount)) return "";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export function getSettingsKeyboardAccessoryPreview(
  field: SettingsKeyboardField,
  inputs: SettingsKeyboardAccessoryInputs,
): { title: string; text: string; isPlaceholder: boolean } | null {
  if (!field) {
    return null;
  }

  switch (field.kind) {
    case "category-name":
      return {
        title: "カテゴリ名",
        text: inputs.categoryName || "カテゴリ名を入力",
        isPlaceholder: !inputs.categoryName,
      };
    case "breakdown-name":
      return {
        title: "内訳名",
        text: inputs.breakdownName || "内訳名を入力",
        isPlaceholder: !inputs.breakdownName,
      };
    case "account-name":
      return {
        title: "口座名",
        text: inputs.accountName || "口座名を入力",
        isPlaceholder: !inputs.accountName,
      };
    case "account-balance": {
      const formatted = formatYenDisplay(inputs.accountBalance);
      return {
        title: "口座残高",
        text: formatted || "初期残高を入力",
        isPlaceholder: !formatted,
      };
    }
    case "budget": {
      const formatted = formatYenDisplay(inputs.budgetValue);
      return {
        title: `${field.categoryName}の予算`,
        text: formatted || "予算額を入力",
        isPlaceholder: !formatted,
      };
    }
    default:
      return null;
  }
}
