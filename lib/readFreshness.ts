export type DataVersion = string | null;

export function hasDataVersionChanged(
  cachedVersion: DataVersion,
  currentVersion: DataVersion,
): boolean {
  return cachedVersion !== currentVersion;
}

export function shouldReadServerForScope(input: {
  hasCachedData: boolean;
  scopeVersion: DataVersion;
  currentDataVersion: DataVersion;
  /**
   * stamp 時に記録した生のDoc件数。旧形式のファイルや差分読み更新では未記録。
   * `cachedDocCount` と揃って与えられたときだけ判定に使う（ADR の R3）。
   */
  stampedDocCount?: number;
  /** 今回のキャッシュ読みで得た生のDoc件数（ソフトデリート除外前）。 */
  cachedDocCount?: number;
}): boolean {
  if (!input.hasCachedData) return true;
  // stamp が無い＝このスコープを一度もサーバーから読み切っていない。キャッシュに
  // 何が入っているか（全件か、過去のページング読みの一部か）を判断する材料が無いので
  // 信用せずサーバーを読む。
  //
  // マーカーも null だと下の比較が `null !== null` で false になり、根拠が無いまま
  // キャッシュを採用してしまう。その穴を塞ぐ。
  if (input.scopeVersion == null) return true;
  // 追加・更新・削除はすべてマーカーが捕まえる。件数比較はここを通り抜けた
  // 場合にだけ意味を持つ。
  if (hasDataVersionChanged(input.scopeVersion, input.currentDataVersion)) {
    return true;
  }
  // マーカーが一致＝書き込みは起きていないはずなのに手元のDocが減っている。
  // Firestore の LRU GC による退避でしか起こらない（ADR の R3）。
  // 件数が増える方向は設計上ありえないため下回ったときだけ見る。
  if (
    input.stampedDocCount !== undefined &&
    input.cachedDocCount !== undefined &&
    input.cachedDocCount < input.stampedDocCount
  ) {
    return true;
  }
  return false;
}
