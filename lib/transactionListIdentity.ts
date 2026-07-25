import type { Transaction } from "./firestore";

/**
 * 取引リストが表示上まったく同じ内容かを判定する（ADR の R4）。
 *
 * キャッシュ先出し（案B）では、描画したあとに背景でサーバー読みが走り、結果を
 * 差し替える。内容が変わっていない場合でも新しい配列を `setItems` すると参照が
 * 変わり、リストが再描画されてスクロール位置が動いたり、その瞬間のタップが
 * 意図しない行に当たったりする。
 *
 * 同一と判定できたときは呼び出し側が前の配列をそのまま保持し、状態が変わらない
 * ため再描画自体が起きない。
 *
 * 比較は位置ごとに行う。両者とも同じクエリ順序（日付降順）で構築されるため、
 * 順序のズレは内容の変化として扱ってよい。
 */
export function areTransactionListsEquivalent(
  a: Transaction[],
  b: Transaction[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === right) continue;
    for (let keyIndex = 0; keyIndex < COMPARED_KEYS.length; keyIndex += 1) {
      const key = COMPARED_KEYS[keyIndex];
      if (left[key] !== right[key]) return false;
    }
  }
  return true;
}

/**
 * 比較対象のフィールド一覧。
 *
 * **`Record<keyof Transaction, true>` として宣言しているのが要点。** `Transaction` に
 * フィールドが増えたとき、ここに足し忘れると**型エラーになる**（プロパティ不足）。
 *
 * 列挙せずに `for...in` でキーを走査する書き方もできるが、`for...in` は
 * プロトタイプチェーンを辿るため、数千件×毎回の再検証では無視できないコストになる。
 * 一方で単純な列挙は追従漏れが起きると「変更を検出できず画面が古いまま固まる」という、
 * 現状より悪い壊れ方をする。型で追従を強制することで両方を満たす。
 *
 * 取引の全フィールドはプリミティブ（string / number / null）なので `!==` で足りる。
 */
const COMPARED_KEY_MAP: Record<keyof Transaction, true> = {
  id: true,
  date: true,
  amount: true,
  type: true,
  accountId: true,
  accountName: true,
  categoryId: true,
  categoryName: true,
  categoryColor: true,
  breakdownId: true,
  breakdownName: true,
  storeId: true,
  storeName: true,
  memo: true,
  createdAt: true,
};

const COMPARED_KEYS = Object.keys(COMPARED_KEY_MAP) as (keyof Transaction)[];

/** テストから参照する（比較対象が型と一致していることの検証用）。 */
export const COMPARED_TRANSACTION_KEYS: readonly (keyof Transaction)[] =
  COMPARED_KEYS;
