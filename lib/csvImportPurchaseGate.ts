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

export type CsvImportPurchaseEnvFlags = {
  purchaseRequired: boolean;
  envUnlocked: boolean;
};

// EXPO_PUBLIC_* は「リテラルな process.env.EXPO_PUBLIC_X 式」だけがビルド時に
// インライン置換される。オブジェクト経由の間接参照（env.EXPO_PUBLIC_X）は
// 本番バンドルで undefined になりゲートが無効化される（build 26 発見事項 #7）。
// devではMetroが process.env に実値を注入するため間接参照でも動いてしまい、
// dev-clientではこの不具合を検出できない点に注意。必ずこの形で読むこと。
const CSV_IMPORT_IAP_ENABLED_ENV =
  process.env.EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED;
const CSV_IMPORT_UNLOCKED_ENV = process.env.EXPO_PUBLIC_CSV_IMPORT_UNLOCKED;

export function getCsvImportPurchaseEnvFlags(
  env?: CsvImportPurchaseEnv,
): CsvImportPurchaseEnvFlags {
  const enabledRaw = env
    ? env.EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED
    : CSV_IMPORT_IAP_ENABLED_ENV;
  const unlockedRaw = env
    ? env.EXPO_PUBLIC_CSV_IMPORT_UNLOCKED
    : CSV_IMPORT_UNLOCKED_ENV;
  return {
    purchaseRequired: enabledRaw === "1",
    envUnlocked: unlockedRaw === "1",
  };
}

export function getCsvImportAccessFromEnv(
  env?: CsvImportPurchaseEnv,
): CsvImportAccess {
  const flags = getCsvImportPurchaseEnvFlags(env);
  return buildCsvImportAccess({
    purchaseRequired: flags.purchaseRequired,
    entitlementPurchased: flags.envUnlocked,
  });
}

/** StoreKit購入一覧の判定に必要な最小フィールド（expo-iapのPurchase互換）。 */
export type CsvImportPurchaseLike = {
  productId: string;
  purchaseState: string;
};

/** 購入一覧にCSVインポート解放の非消耗型IAPが含まれるか判定する。 */
export function hasCsvImportPurchase(
  purchases: readonly CsvImportPurchaseLike[],
): boolean {
  return purchases.some(
    (purchase) =>
      purchase.productId === CSV_IMPORT_PRODUCT_ID &&
      purchase.purchaseState === "purchased",
  );
}

/** 端末内エンタイトルメント保存ファイルの中身（純関数。ファイルIOは csvImportEntitlement.ts）。 */
export function serializeCsvImportEntitlement(purchased: boolean): string {
  return JSON.stringify({ csvImportPurchased: purchased });
}

export function parseCsvImportEntitlement(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { csvImportPurchased?: unknown }).csvImportPurchased === true
    );
  } catch {
    return false;
  }
}
