import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from "expo-iap";

import { saveCsvImportEntitlement } from "@/lib/csvImportEntitlement";
import {
  CSV_IMPORT_PRODUCT_ID,
  hasCsvImportPurchase,
} from "@/lib/csvImportPurchaseGate";

export type CsvImportPurchaseResult =
  | { outcome: "purchased" }
  | { outcome: "cancelled" }
  | { outcome: "failed"; message: string };

export type CsvImportRestoreResult =
  | { outcome: "restored" }
  | { outcome: "not-found" }
  | { outcome: "failed"; message: string };

let connectionPromise: Promise<unknown> | null = null;

/** StoreKit接続を初回利用時に一度だけ確立する。失敗時は次回呼び出しで再試行。 */
async function ensureIapConnection(): Promise<void> {
  if (!connectionPromise) {
    connectionPromise = initConnection().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  await connectionPromise;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** CSVインポート解放の非消耗型IAPを購入する。
 *  requestPurchase はイベントベースのため、結果は purchaseUpdatedListener /
 *  purchaseErrorListener で受けてPromiseに変換する。 */
export async function purchaseCsvImportUnlock(): Promise<CsvImportPurchaseResult> {
  try {
    await ensureIapConnection();
    const products = await fetchProducts({
      skus: [CSV_IMPORT_PRODUCT_ID],
      type: "in-app",
    });
    if (!products || products.length === 0) {
      return {
        outcome: "failed",
        message:
          "App Storeから商品情報を取得できませんでした。時間をおいて再試行してください。",
      };
    }
  } catch (error) {
    return { outcome: "failed", message: errorMessage(error) };
  }

  return await new Promise<CsvImportPurchaseResult>((resolve) => {
    let settled = false;

    const settle = (result: CsvImportPurchaseResult) => {
      if (settled) return;
      settled = true;
      updateSubscription.remove();
      errorSubscription.remove();
      resolve(result);
    };

    const updateSubscription = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== CSV_IMPORT_PRODUCT_ID) return;
      // Ask to Buy（承認待ち）等。承認完了時に改めてpurchasedイベントが届く
      if (purchase.purchaseState === "pending") return;

      void (async () => {
        // エンタイトルメント保存を先に行い、finishTransaction失敗時も購入済み扱いを保つ
        // （未finishのトランザクションはStoreKitが次回接続時に再送する）
        await saveCsvImportEntitlement(true);
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch {
          // 上記コメントのとおり無視してよい
        }
        settle({ outcome: "purchased" });
      })();
    });

    const errorSubscription = purchaseErrorListener((error) => {
      if (error.code === ErrorCode.UserCancelled) {
        settle({ outcome: "cancelled" });
      } else {
        settle({ outcome: "failed", message: error.message });
      }
    });

    requestPurchase({
      request: { apple: { sku: CSV_IMPORT_PRODUCT_ID } },
      type: "in-app",
    }).catch((error) => {
      settle({ outcome: "failed", message: errorMessage(error) });
    });
  });
}

/** 購入済みIAPをStoreKitから復元する（機種変更・再インストール・再ビルド後）。 */
export async function restoreCsvImportUnlock(): Promise<CsvImportRestoreResult> {
  try {
    await ensureIapConnection();
    const purchases = await getAvailablePurchases();
    if (!hasCsvImportPurchase(purchases)) {
      return { outcome: "not-found" };
    }
    await saveCsvImportEntitlement(true);
    // 未finishのままキューに残っている購入があれば完了させる（起動ごとの再送を止める）
    for (const purchase of purchases) {
      if (purchase.productId !== CSV_IMPORT_PRODUCT_ID) continue;
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // finish済みトランザクションのエラーは無視してよい
      }
    }
    return { outcome: "restored" };
  } catch (error) {
    return { outcome: "failed", message: errorMessage(error) };
  }
}
