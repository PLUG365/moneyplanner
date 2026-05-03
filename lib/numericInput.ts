export type NumericInputKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "+"
  | "-"
  | "*"
  | "/"
  | "backspace"
  | "clear";

export type NumericInputOptions = {
  allowOperators?: boolean;
  allowNegative?: boolean;
};

const OPERATORS = new Set(["+", "-", "*", "/"]);

function isOperator(value: string): boolean {
  return OPERATORS.has(value);
}

export function applyNumericInputKey(
  currentValue: string,
  key: NumericInputKey,
  options: NumericInputOptions,
): string {
  if (key === "clear") return "";
  if (key === "backspace") return currentValue.slice(0, -1);

  if (isOperator(key)) {
    if (!options.allowOperators) return currentValue;
    if (key === "-" && currentValue === "" && options.allowNegative) {
      return "-";
    }
    if (currentValue === "" || currentValue === "-") return currentValue;

    const lastChar = currentValue.at(-1) ?? "";
    if (isOperator(lastChar)) {
      return `${currentValue.slice(0, -1)}${key}`;
    }
    return `${currentValue}${key}`;
  }

  if (currentValue === "0") return key;
  if (currentValue === "-0") return `-${key}`;
  return `${currentValue}${key}`;
}
