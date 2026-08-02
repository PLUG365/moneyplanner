export type PaginatedTransactionsRangeLike = {
  from: string | null;
  to: string | null;
};

export function shouldFetchAllTransactions(input: {
  readAll: boolean;
  range: PaginatedTransactionsRangeLike;
}): boolean {
  return input.readAll || !!(input.range.from && input.range.to);
}

export function buildPaginatedTransactionsScopeKey(
  householdId: string,
  range: PaginatedTransactionsRangeLike,
  readAll: boolean,
): string {
  const mode = readAll ? "all" : "page";
  return `${householdId}:transactions:history:${mode}:${range.from ?? ""}:${
    range.to ?? ""
  }`;
}

/**
 * 履歴の先頭ページをキャッシュから読むときに試す日付下限（月数）。新しい順。
 * `null` は「下限なし＝全期間」を表す。
 *
 * Firestore のローカルクエリはローカルインデックスを持たないため、`limit` を
 * 付けても**候補を全部 materialize してから上位N件を選ぶ**。取引が1万件規模に
 * なると先頭100件を得るだけで数秒かかる。日付の下限を付けると候補そのものが
 * 減るため、走査量を実データに見合う量まで落とせる。
 *
 * 段階的に広げるのは、取引が疎な世帯でも先頭ページを埋めるため。
 */
export const HISTORY_CACHE_WINDOW_MONTHS: readonly (number | null)[] = [
  3,
  12,
  36,
  null,
];

/**
 * 基準日から指定月数さかのぼった日付を `YYYY-MM-DD` で返す。
 *
 * 取引の `date` フィールドはローカル日付の文字列なので、UTC変換を挟まずに
 * ローカルの年月日で組み立てる。月の繰り下がりは `Date` に任せる
 * （例: 3月31日の1ヶ月前は2月末を超えるため4月2日側へ寄るが、下限としては
 * 狭くなる方向であり、足りなければ次の窓へ広げるので安全側に倒れる）。
 */
export function monthsAgoDateString(base: Date, months: number): string {
  const shifted = new Date(
    base.getFullYear(),
    base.getMonth() - months,
    base.getDate(),
  );
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function versionToMillis(version: string): number | null {
  const numeric = Number(version);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = new Date(version).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function pickNewestDataVersion(
  left: string | null,
  right: string | null,
): string | null {
  if (left == null) return right;
  if (right == null) return left;
  const leftMillis = versionToMillis(left);
  const rightMillis = versionToMillis(right);
  if (leftMillis == null || rightMillis == null) return right;
  return leftMillis >= rightMillis ? left : right;
}
