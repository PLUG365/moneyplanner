export function isValidTransactionAmount(
  amount: number | null,
  memo: string,
): amount is number {
  if (amount === null) return false;
  if (amount < 0) return false;
  if (amount === 0) return memo.trim().length > 0;
  return true;
}
