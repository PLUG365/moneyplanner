export type BulkCopyResult = {
  /** 書き込みまで成立した件数。 */
  copied: number;
  /** 書き込みに失敗して未コピーになった件数。 */
  failed: number;
  /** 選択時点の記録が見つからず処理対象外になった件数。 */
  skipped: number;
  /** 口座が現存せず既定口座で登録した件数。 */
  accountFallback: number;
  /** カテゴリが現存せずスナップショット名のまま登録した件数（Issue #12）。 */
  categoryFallback: number;
};

export type BulkCopyAlert = {
  title: string;
  message: string;
};

/**
 * 一括コピーの完了通知を組み立てる。`null` はアラートを出さない（未コピー一覧の
 * モーダルだけで足りる）ことを表す。
 */
export function buildBulkCopyAlert(result: BulkCopyResult): BulkCopyAlert | null {
  if (result.copied === 0) {
    // 未コピーの明細はモーダル側で理由付きに出すため、重ねてアラートを出さない。
    if (result.failed > 0) return null;
    return {
      title: "コピーできませんでした",
      message: "コピー対象が見つかりません",
    };
  }

  const uncopied = Math.max(result.failed, result.skipped);
  const lines = [
    uncopied > 0
      ? `${result.copied}件コピーしました（${uncopied}件未コピー）`
      : `${result.copied}件コピーしました`,
  ];
  if (result.accountFallback > 0) {
    lines.push(
      `口座が存在しない${result.accountFallback}件は既定口座で登録されました。`,
    );
  }
  if (result.categoryFallback > 0) {
    lines.push(
      `カテゴリが存在しない${result.categoryFallback}件は元のカテゴリ名のまま登録されました。`,
    );
  }

  return { title: "一括コピー完了", message: lines.join("\n") };
}
