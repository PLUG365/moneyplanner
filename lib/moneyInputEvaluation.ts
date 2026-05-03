import { resolveMoneyInput, type MoneyInputResolveOptions } from "./moneyInput";

export type MoneyInputEvaluationResult =
  | { kind: "valid"; value: string; shouldConfirm: true }
  | { kind: "invalid"; shouldConfirm: false };

export function evaluateMoneyInputForModal(
  value: string,
  options: MoneyInputResolveOptions,
): MoneyInputEvaluationResult {
  const result = resolveMoneyInput(value, options);
  if (result === null) {
    return { kind: "invalid", shouldConfirm: false };
  }

  return { kind: "valid", value: String(result), shouldConfirm: true };
}
