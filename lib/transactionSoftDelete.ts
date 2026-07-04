/** 取引のソフトデリート判定（issue #4 / ADR: transaction-soft-delete）。
 *
 *  取引の削除は物理削除ではなく `deleted: true` + `updatedAt` 更新で表現する。
 *  物理削除だと `updatedAt` 差分クエリで削除を検知できず、SDKローカルキャッシュに
 *  削除済みドキュメントが残り続ける（幽霊データ）ため。
 *  読み側の除外はこのモジュールの判定に一元化し、履歴・検索・集計・カレンダー・
 *  CSVエクスポート・残高計算のすべてで同じ基準を使う。
 */

type TransactionDataLike = {
  deleted?: unknown;
};

type TransactionDocLike<TData extends TransactionDataLike> = {
  data: () => TData;
};

export function isDeletedTransactionData(
  data: TransactionDataLike | null | undefined,
): boolean {
  return data?.deleted === true;
}

/** スナップショットのドキュメント配列からソフトデリート済みを除外する。 */
export function excludeDeletedTransactionDocs<
  TData extends TransactionDataLike,
  TDoc extends TransactionDocLike<TData>,
>(docs: TDoc[]): TDoc[] {
  return docs.filter((docSnap) => !isDeletedTransactionData(docSnap.data()));
}
