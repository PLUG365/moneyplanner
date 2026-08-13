/**
 * スコープ変更中に、古いスコープの読み込み結果が画面へ書き込まれるのを防ぐ判定。
 *
 * `docs/decisions/initial-render-latency-version-check.md` の
 * 「既知の別問題: スコープ変更中の古いスコープ `setData`」に対応する。
 *
 * `useCachedTransactions` の `load` は `inFlightRef` で直列化されるが、進行中の
 * クロージャは自分が起動した時点の `scopeKey`/`range` を保持したままである。
 * 集計タブで年を切り替えると、旧スコープの読みが完了したときに旧年の配列が
 * `setData` され、直後に新スコープの読みが上書きする。ユーザーには前の年の
 * 数値が一瞬見える。
 *
 * ここで固定する方針:
 *
 * - **判定は「世代番号」ではなく「最後に要求されたスコープキー」との一致で行う。**
 *   世代番号を増やす方式は、増やす場所を1つ間違えるだけで正しい更新まで捨てて
 *   画面が固着する。スコープキー一致なら、同一スコープの再読込（pull-to-refresh）
 *   では常に一致するため、既存の挙動を一切変えない。
 * - **止めるのは表示状態の書き込みだけ。** ローディング解除・進行中フラグの解放・
 *   予約された再読込の実行は、stale でも必ず行う。ここを止めると、修正前より
 *   重い症状（固着）になる。
 * - **キャッシュへの保存は止めない。** `transactionScopeCache` も
 *   `scopeVersionStore` もキーがスコープ別なので、古いスコープの結果として
 *   正しく、後で同じスコープへ戻ったときに再利用できる。
 */

export type StaleScopeWriteDecision = {
  /** `setData` / `setFromCache` / `setIsComplete` / 描画済みスコープの記録。 */
  applyContent: boolean;
  /** `setHasSettled`。空メッセージの表示可否を確定させる書き込み。 */
  applySettled: boolean;
  /** `setError`。 */
  applyError: boolean;
  /**
   * `setLoading(false)`。**常に true。**
   *
   * stale だからと解除を飛ばすと、後続の読みが `setLoading(true)` を通らない
   * 経路（描画済みで全件と分かっている場合）へ入ったときにオーバーレイが
   * 残り続ける。解除は安全側なので無条件に通す。
   */
  applyLoadingRelease: boolean;
  /**
   * `inFlightRef` の解放と、予約された再読込の実行。**常に true。**
   *
   * ここを止めると新しいスコープが永久に読まれない。
   */
  applyFlowRelease: boolean;
};

/**
 * 読み込み結果を画面へ反映してよいかを決める。
 *
 * @param resultScopeKey  その読み込みが対象としているスコープのキャッシュキー。
 * @param requestedScopeKey  最後に要求されたスコープのキャッシュキー。世帯IDが
 *   未解決・消失している間は `null` を渡す（どのスコープの結果も反映しない）。
 */
export function decideStaleScopeWrite(input: {
  resultScopeKey: string;
  requestedScopeKey: string | null;
}): StaleScopeWriteDecision {
  const isCurrent =
    input.requestedScopeKey !== null &&
    input.requestedScopeKey === input.resultScopeKey;

  return {
    applyContent: isCurrent,
    applySettled: isCurrent,
    applyError: isCurrent,
    applyLoadingRelease: true,
    applyFlowRelease: true,
  };
}

/** 読み込み結果を画面へ反映してよいか（`applyContent` の簡易版）。 */
export function isCurrentScopeResult(input: {
  resultScopeKey: string;
  requestedScopeKey: string | null;
}): boolean {
  return decideStaleScopeWrite(input).applyContent;
}

/**
 * いま画面に出ている内容を、要求されたスコープ用に破棄すべきか。
 *
 * 進行中の読みがあるときに別スコープが要求されると、その要求は予約へ回されて
 * すぐには実行されない。**書き込みを止めるだけでは足りない**: 旧スコープの
 * 内容は既に描画済みなので、予約が実行されるまで前の年の数値が出たままになる。
 * 要求を受け付けた時点で表示状態を無効化する必要がある。
 *
 * 判定はスコープの不一致だけで行う。`forceServer`（pull-to-refresh）を理由に
 * 保持してはいけない。同一スコープの更新なら不一致にならないので画面は空に
 * ならず、スコープが違うなら更新中かどうかに関わらず別の年の数値である。
 */
export function shouldClearPaintedForScopeChange(input: {
  paintedScopeKey: string | null;
  targetScopeKey: string | null;
}): boolean {
  return input.paintedScopeKey !== input.targetScopeKey;
}
