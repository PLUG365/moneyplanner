import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { buildCsvRowsFromTransactions } from "./csvExportRows";
import { buildCsvUtf8Base64 } from "./csvFormat";
import { getAllTransactions, Transaction } from "./firestore";

export async function exportCSV(transactions?: Transaction[]) {
  const data = transactions ?? (await getAllTransactions());
  const csvRows = buildCsvRowsFromTransactions(data);
  const csvBase64 = buildCsvUtf8Base64(csvRows);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `moneyplanner_${dateStr}.csv`;
  const path = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csvBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: "CSVを共有",
      UTI: "public.comma-separated-values-text",
    });
  }
}
