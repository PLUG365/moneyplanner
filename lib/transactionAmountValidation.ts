/** 取引金額の上限（1億円）。手入力・CSVインポート・Firestore Rules で共通。 */
export const MAX_TRANSACTION_AMOUNT = 100_000_000;

export function isValidTransactionAmount(
  amount: number | null,
  memo: string,
): amount is number {
  if (amount === null) return false;
  if (amount < 0) return false;
  if (amount > MAX_TRANSACTION_AMOUNT) return false;
  if (amount === 0) return memo.trim().length > 0;
  return true;
}
