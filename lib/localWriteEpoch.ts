/**
 * 端末自身が行った書き込みを、各フックのメモリキャッシュへ伝えるためのカウンタ。
 *
 * 背景（`docs/decisions/initial-render-latency-version-check.md` の R1）:
 * キャッシュ先出し（案B）では、マーカーのサーバー往復を待たずにメモリ上の配列を
 * 先に描画する。このとき自分が直前に記録した取引がメモリキャッシュに反映されて
 * いないと、「いま入力した金額が入っていない合計」を一瞬見せることになる。
 *
 * サーバーに問い合わせなくても、自分が書いたことは自分で分かっている。書き込みの
 * たびに世帯ごとのカウンタを進め、メモリキャッシュのエントリが持つ値と一致しなければ
 * そのエントリは使わない、という判定にする。
 *
 * カウンタを進めたあとの初回描画は Firestore のディスクキャッシュ読みになる。
 * ディスクキャッシュは未送信の書き込みも含むため、オフラインでも自分の記録が
 * 反映された状態で描画される。ローカル読みのままなので速度も落ちない。
 *
 * プロセス内でのみ有効（永続化しない）。再起動後はメモリキャッシュ自体が空になる。
 */
const epochByHousehold = new Map<string, number>();

/** 世帯データを書き換えたときに呼ぶ。 */
export function bumpLocalWriteEpoch(householdId: string): void {
  if (!householdId) return;
  epochByHousehold.set(householdId, (epochByHousehold.get(householdId) ?? 0) + 1);
}

/** メモリキャッシュへ保存するときの現在値。未書き込みの世帯は 0。 */
export function getLocalWriteEpoch(householdId: string): number {
  return epochByHousehold.get(householdId) ?? 0;
}

/**
 * キャッシュエントリを使ってよいか。
 * エントリ保存時の値と現在値が一致するときだけ true。
 */
export function isLocalWriteEpochCurrent(
  householdId: string,
  epoch: number | undefined,
): boolean {
  return epoch === getLocalWriteEpoch(householdId);
}

/** テスト用。サインアウト・世帯切替でも使える。 */
export function resetLocalWriteEpochs(): void {
  epochByHousehold.clear();
}
