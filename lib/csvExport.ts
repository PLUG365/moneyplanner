import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { buildCsvRowsFromTransactions } from "./csvExportRows";
import { buildCsvExcelBase64 } from "./csvFormat";
import { getAllTransactions, Transaction } from "./firestore";

export async function exportCSV(transactions?: Transaction[]) {
  const data = transactions ?? (await getAllTransactions());
  const csvRows = buildCsvRowsFromTransactions(data);
  const csvBase64 = buildCsvExcelBase64(csvRows);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `moneyplanner_${dateStr}.csv`;
  // 家計データ全件を含むファイルを端末に残さないよう、documentDirectory ではなく
  // cacheDirectory へ書き出し、共有完了（キャンセル含む）後に削除する。
  const path = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csvBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: "text/csv",
        dialogTitle: "CSVを共有",
        UTI: "public.comma-separated-values-text",
      });
    }
  } finally {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}
