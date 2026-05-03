export type MoneyInputOptions = {
  allowOperators?: boolean;
  allowNegative?: boolean;
};

export type MoneyInputResolveOptions = MoneyInputOptions & {
  emptyValue?: number | null;
};

export function normalizeMoneyInput(
  input: string,
  options: MoneyInputOptions = {},
): string {
  const normalized = input.replace(/[×xX]/g, "*").replace(/[÷]/g, "/");
  if (options.allowOperators) {
    return normalized.replace(/[^0-9+\-*/]/g, "");
  }

  if (!options.allowNegative) {
    return normalized.replace(/\D/g, "");
  }

  const firstDigitIndex = normalized.search(/\d/);
  const firstMinusIndex = normalized.indexOf("-");
  const hasLeadingMinus =
    firstMinusIndex !== -1 &&
    (firstDigitIndex === -1 || firstMinusIndex < firstDigitIndex);
  const digits = normalized.replace(/\D/g, "");

  if (!digits) return hasLeadingMinus ? "-" : "";
  return `${hasLeadingMinus ? "-" : ""}${digits}`;
}

export function formatMoneyInputDisplay(
  input: string,
  options: MoneyInputOptions = {},
): string {
  if (!input) return "";
  if (options.allowOperators && (/[+*/]/.test(input) || /\d-\d/.test(input))) {
    return input.replace(/\*/g, "×").replace(/\//g, "÷");
  }

  if (input === "-") return "-";
  const amount = parseInt(input, 10);
  if (Number.isNaN(amount)) return "";
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

export function resolveMoneyInput(
  input: string,
  options: MoneyInputResolveOptions = {},
): number | null {
  const expression = normalizeMoneyInput(input, {
    allowOperators: true,
    allowNegative: options.allowNegative,
  });
  if (!expression) return options.emptyValue ?? null;

  const leadingPattern = options.allowNegative ? "-?" : "";
  const expressionPattern = new RegExp(
    `^${leadingPattern}\\d+(?:[+\\-*/]\\d+)*$`,
  );
  if (!expressionPattern.test(expression)) return null;

  const firstValue = expression.match(
    new RegExp(`^${leadingPattern}\\d+`),
  )?.[0];
  if (!firstValue) return null;

  let result = parseInt(firstValue, 10);
  let index = firstValue.length;

  while (index < expression.length) {
    const operator = expression[index];
    const rest = expression.slice(index + 1);
    const nextValue = rest.match(/^\d+/)?.[0];
    if (!nextValue) return null;

    const operand = parseInt(nextValue, 10);
    if (operator === "+") {
      result += operand;
    } else if (operator === "-") {
      result -= operand;
    } else if (operator === "*") {
      result *= operand;
    } else if (operator === "/") {
      if (operand === 0) return null;
      result = Math.trunc(result / operand);
    } else {
      return null;
    }

    index += 1 + nextValue.length;
  }

  return result;
}
