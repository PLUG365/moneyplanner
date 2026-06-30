export const CSV_IMPORT_PRODUCT_ID = "csv_import_unlock";
export const CSV_IMPORT_PRICE_LABEL = "¥300";

export type CsvImportAccessInput = {
  purchaseRequired: boolean;
  entitlementPurchased: boolean;
};

export type CsvImportPurchaseEnv = Partial<{
  EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED: string;
  EXPO_PUBLIC_CSV_IMPORT_UNLOCKED: string;
}>;

export type CsvImportAccess = {
  allowed: boolean;
  productId: string;
  priceLabel: string;
  message: string;
};

export function buildCsvImportAccess(
  input: CsvImportAccessInput,
): CsvImportAccess {
  const allowed = !input.purchaseRequired || input.entitlementPurchased;
  return {
    allowed,
    productId: CSV_IMPORT_PRODUCT_ID,
    priceLabel: CSV_IMPORT_PRICE_LABEL,
    message: allowed
      ? ""
      : `CSVインポートは買い切りのアプリ内課金（${CSV_IMPORT_PRICE_LABEL}）でロック解除できます。`,
  };
}

export function getCsvImportAccessFromEnv(
  env: CsvImportPurchaseEnv = process.env as CsvImportPurchaseEnv,
): CsvImportAccess {
  return buildCsvImportAccess({
    purchaseRequired: env.EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED === "1",
    entitlementPurchased: env.EXPO_PUBLIC_CSV_IMPORT_UNLOCKED === "1",
  });
}
