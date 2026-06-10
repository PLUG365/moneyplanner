import {
    formatMoneyInputDisplay,
    normalizeMoneyInput,
    resolveMoneyInput,
} from "./moneyInput";

export function normalizeTransactionAmountInput(input: string): string {
  return normalizeMoneyInput(input, { allowOperators: true });
}

export function formatTransactionAmountInputDisplay(input: string): string {
  return formatMoneyInputDisplay(input, { allowOperators: true });
}

export function resolveTransactionAmountInput(input: string): number | null {
  // 未入力は0円として扱う（画面表示も「¥0」のため）。
  // 金額0はメモがある場合のみ登録可（isValidTransactionAmount側で判定）。
  return resolveMoneyInput(input, { allowOperators: true, emptyValue: 0 });
}
