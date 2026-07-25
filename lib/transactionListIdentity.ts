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
    // ID違いは内容比較するまでもなく別物。大量件数での早期打ち切りに効く。
    if (left.id !== right.id) return false;
    if (!shallowEqualRecord(left, right)) return false;
  }
  return true;
}

/**
 * 取引の全フィールドはプリミティブ（string / number / null）なので浅い比較で足りる。
 * フィールドを明示列挙すると型に項目が増えたとき追従漏れが起きるため、キーを走査する。
 * キー配列を確保せずに数えることで、数千件の比較でも余計な確保を出さない。
 */
function shallowEqualRecord(left: Transaction, right: Transaction): boolean {
  // interface には暗黙のインデックスシグネチャが無いため、走査のためだけに変換する。
  const a = left as unknown as Record<string, unknown>;
  const b = right as unknown as Record<string, unknown>;
  let leftKeyCount = 0;
  for (const key in a) {
    leftKeyCount += 1;
    if (a[key] !== b[key]) return false;
  }
  let rightKeyCount = 0;
  for (const key in b) rightKeyCount += 1;
  return leftKeyCount === rightKeyCount;
}
