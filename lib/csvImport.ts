import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { decodeCsvTextFromBase64 } from "./csvEncoding";
import { CsvImportError, parseImportCsv } from "./csvImportParse";
import { resolveImportRows } from "./csvImportResolve";
import {
    DEFAULT_ACCOUNT_ID,
    getAccounts,
    getAllBreakdowns,
    getCategories,
    getStoresByCategory,
    importTransactions,
    readHouseholdDataVersionPreferServer,
} from "./firestore";
  import { getHouseholdId } from "./household";
  import { buildPaginatedTransactionsScopeKey } from "./paginatedTransactionsMode";
  import { setPersistedScopeVersion } from "./scopeVersionStore";

export type CsvImportPrepareResult =
  | { status: "cancelled" }
  | { status: "encoding-error" }
  | { status: "format-error"; errors: CsvImportError[] }
  | {
      status: "ready";
      rowCount: number;
      execute: (
        onProgress?: (done: number, total: number) => void,
      ) => Promise<number>;
    };

/** ファイル選択→読込→検証→マスタ解決まで行い、書込は execute() に遅延する。
 *  呼び出し側で件数確認ダイアログを挟むため。 */
export async function prepareCsvImport(): Promise<CsvImportPrepareResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) {
    return { status: "cancelled" };
  }

  const encoded = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const text = decodeCsvTextFromBase64(encoded);
  if (!text) {
    return { status: "encoding-error" };
  }

  const { rows, errors } = parseImportCsv(text);
  if (errors.length > 0) {
    return { status: "format-error", errors };
  }

  const [accounts, categories, breakdowns, stores] = await Promise.all([
    getAccounts(),
    getCategories(),
    getAllBreakdowns(),
    getStoresByCategory(),
  ]);

  const resolved = resolveImportRows(rows, {
    accounts,
    categories,
    breakdowns,
    stores,
    defaultAccountId: DEFAULT_ACCOUNT_ID,
  });

  return {
    status: "ready",
    rowCount: resolved.length,
    execute: async (onProgress) => {
      const count = await importTransactions(
        resolved.map((row) => ({
          date: row.date,
          amount: row.amount,
          type: row.type,
          accountId: row.accountId,
          categoryId: row.categoryId,
          breakdownId: row.breakdownId,
          storeId: row.storeId,
          memo: row.memo,
          metadata: {
            accountName: row.accountName,
            categoryName: row.categoryName,
            categoryColor: row.categoryColor,
            breakdownName: row.breakdownName,
            storeName: row.storeName,
          },
        })),
        onProgress,
      );
      const householdId = await getHouseholdId();
      if (householdId) {
        const version = await readHouseholdDataVersionPreferServer(householdId);
        setPersistedScopeVersion(
          buildPaginatedTransactionsScopeKey(
            householdId,
            { from: null, to: null },
            true,
          ),
          version,
        );
      }
      return count;
    },
  };
}

export function formatImportErrors(
  errors: CsvImportError[],
  maxLines = 5,
): string {
  const lines = errors
    .slice(0, maxLines)
    .map((error) => `行${error.line}: ${error.message}`);
  if (errors.length > maxLines) {
    lines.push(`…他${errors.length - maxLines}件`);
  }
  return lines.join("\n");
}
