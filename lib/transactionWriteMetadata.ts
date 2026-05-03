export type TransactionWriteMetadataInput = {
  accountName?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  breakdownName?: string | null;
  storeName?: string | null;
};

export type TransactionWriteMetadata = {
  accountName: string;
  categoryName: string;
  categoryColor: string;
  breakdownName: string;
  storeName: string;
};

function nonEmptyOr(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

export function buildTransactionWriteMetadata(
  input: TransactionWriteMetadataInput,
): TransactionWriteMetadata {
  return {
    accountName: nonEmptyOr(input.accountName, "家計"),
    categoryName: nonEmptyOr(input.categoryName, "未分類"),
    categoryColor: nonEmptyOr(input.categoryColor, "#666666"),
    breakdownName: input.breakdownName?.trim() ?? "",
    storeName: input.storeName?.trim() ?? "",
  };
}
