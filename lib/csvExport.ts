import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getAllTransactions, Transaction } from './database';

export async function exportCSV(transactions?: Transaction[]) {
  const data = transactions ?? getAllTransactions();

  const header = '日付,種別,カテゴリ,金額,メモ\n';
  const rows = data
    .map(t => {
      const type = t.type === 'income' ? '収入' : '支出';
      const memo = (t.memo ?? '').replace(/,/g, '、').replace(/\n/g, ' ');
      return `${t.date},${type},${t.categoryName},${t.amount},${memo}`;
    })
    .join('\n');

  // BOM付きUTF-8 (Excelで文字化けしないよう)
  const csv = '\uFEFF' + header + rows;
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `moneyplanner_${dateStr}.csv`;
  const path = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'CSVを共有',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
