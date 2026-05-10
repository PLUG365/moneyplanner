import {
    formatMoneyInputDisplay,
    normalizeMoneyInput,
    resolveMoneyInput,
} from "./moneyInput";

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
  return formatMoneyInputDisplay(rawDigits, { allowNegative: true });
}

export function normalizeSignedYenInput(input: string): string {
  return normalizeMoneyInput(input, { allowNegative: true });
}

export function normalizeAccountBalanceInput(input: string): string {
  return normalizeMoneyInput(input, {
    allowOperators: true,
    allowNegative: true,
  });
}

export function formatAccountBalanceInputDisplay(input: string): string {
  return formatMoneyInputDisplay(input, {
    allowOperators: true,
    allowNegative: true,
  });
}

export function resolveAccountBalanceInput(input: string): number | null {
  return resolveMoneyInput(input, {
    allowOperators: true,
    allowNegative: true,
    emptyValue: 0,
  });
}

export function normalizeBudgetInput(input: string): string {
  return normalizeMoneyInput(input, {
    allowOperators: true,
    allowNegative: false,
  });
}

export function formatBudgetInputDisplay(input: string): string {
  return formatMoneyInputDisplay(input, {
    allowOperators: true,
    allowNegative: false,
  });
}

export function resolveBudgetInput(input: string): number | null {
  return resolveMoneyInput(input, {
    allowOperators: true,
    allowNegative: false,
    emptyValue: null,
  });
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
      const formatted = formatAccountBalanceInputDisplay(inputs.accountBalance);
      return {
        title: "初期残高",
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
