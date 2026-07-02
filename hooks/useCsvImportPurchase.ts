import { useCallback, useEffect, useMemo, useState } from "react";

import { loadCsvImportEntitlement } from "@/lib/csvImportEntitlement";
import {
  purchaseCsvImportUnlock,
  restoreCsvImportUnlock,
  type CsvImportPurchaseResult,
  type CsvImportRestoreResult,
} from "@/lib/csvImportIap";
import {
  buildCsvImportAccess,
  getCsvImportPurchaseEnvFlags,
  type CsvImportAccess,
} from "@/lib/csvImportPurchaseGate";

export type UseCsvImportPurchase = {
  access: CsvImportAccess;
  /** 購入または復元の処理中（二重起動防止用） */
  purchasing: boolean;
  purchase: () => Promise<CsvImportPurchaseResult>;
  restore: () => Promise<CsvImportRestoreResult>;
};

/** CSVインポートの購入ゲート状態と購入/復元操作を提供する。
 *  ゲート無効ビルド（EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED未設定）ではStoreKitに接続しない。 */
export function useCsvImportPurchase(): UseCsvImportPurchase {
  const { purchaseRequired, envUnlocked } = useMemo(
    () => getCsvImportPurchaseEnvFlags(),
    [],
  );
  const [storeEntitled, setStoreEntitled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!purchaseRequired || envUnlocked) return;
    let mounted = true;
    void loadCsvImportEntitlement().then((purchased) => {
      if (mounted && purchased) setStoreEntitled(true);
    });
    return () => {
      mounted = false;
    };
  }, [purchaseRequired, envUnlocked]);

  const access = useMemo(
    () =>
      buildCsvImportAccess({
        purchaseRequired,
        entitlementPurchased: envUnlocked || storeEntitled,
      }),
    [purchaseRequired, envUnlocked, storeEntitled],
  );

  const purchase = useCallback(async (): Promise<CsvImportPurchaseResult> => {
    setPurchasing(true);
    try {
      const result = await purchaseCsvImportUnlock();
      if (result.outcome === "purchased") setStoreEntitled(true);
      return result;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<CsvImportRestoreResult> => {
    setPurchasing(true);
    try {
      const result = await restoreCsvImportUnlock();
      if (result.outcome === "restored") setStoreEntitled(true);
      return result;
    } finally {
      setPurchasing(false);
    }
  }, []);

  return { access, purchasing, purchase, restore };
}
