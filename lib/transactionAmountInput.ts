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
  return resolveMoneyInput(input, { allowOperators: true, emptyValue: null });
}
