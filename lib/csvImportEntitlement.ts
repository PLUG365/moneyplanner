import * as FileSystem from "expo-file-system/legacy";

import {
  parseCsvImportEntitlement,
  serializeCsvImportEntitlement,
} from "@/lib/csvImportPurchaseGate";

const ENTITLEMENT_FILE = "csv-import-entitlement.json";

function entitlementFileUri(): string {
  return `${FileSystem.documentDirectory}${ENTITLEMENT_FILE}`;
}

/** 端末に保存済みのCSVインポート購入状態を読む。未保存・読込失敗は未購入扱い。
 *  本来の正はStoreKitのエンタイトルメントで、これは起動直後・オフライン時の
 *  表示用キャッシュ。復元導線（getAvailablePurchases）でいつでも再取得できる。 */
export async function loadCsvImportEntitlement(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(entitlementFileUri());
    if (!info.exists) return false;
    const raw = await FileSystem.readAsStringAsync(entitlementFileUri());
    return parseCsvImportEntitlement(raw);
  } catch {
    return false;
  }
}

export async function saveCsvImportEntitlement(
  purchased: boolean,
): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      entitlementFileUri(),
      serializeCsvImportEntitlement(purchased),
    );
  } catch {
    // 保存失敗は致命的でない。次回は復元導線でStoreKitから再取得できる
  }
}
