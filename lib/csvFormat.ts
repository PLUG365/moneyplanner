export type CsvTransaction = {
  date: string;
  type: "income" | "expense";
  accountName: string;
  categoryName: string;
  breakdownName: string;
  amount: number;
  memo: string;
};

function escapeCsvField(value: string): string {
  const normalized = (value ?? "").replace(/\r?\n/g, " ");
  if (normalized.includes(",") || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildCsvText(transactions: CsvTransaction[]): string {
  const header = "日付,種別,口座,カテゴリ,内訳,金額,メモ";
  const rows = transactions.map((t) => {
    const type = t.type === "income" ? "収入" : "支出";
    return [
      t.date,
      type,
      escapeCsvField(t.accountName ?? ""),
      escapeCsvField(t.categoryName ?? ""),
      escapeCsvField(t.breakdownName ?? ""),
      String(t.amount),
      escapeCsvField(t.memo ?? ""),
    ].join(",");
  });

  // BOM + CRLF for Excel compatibility.
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}

const BASE64_TABLE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    out += BASE64_TABLE[(triple >> 18) & 0x3f];
    out += BASE64_TABLE[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? BASE64_TABLE[(triple >> 6) & 0x3f] : "=";
    out += i + 2 < bytes.length ? BASE64_TABLE[triple & 0x3f] : "=";
  }
  return out;
}

/** UTF-8 BOM 付き CSV を base64 エンコードで返す。
 *  TextEncoder で UTF-8 バイト列を正確に構築し、
 *  FileSystem.writeAsStringAsync(path, b64, { encoding: Base64 }) で書き込むことで
 *  BOM (EF BB BF) が確実にファイル先頭に入る。 */
export function buildCsvUtf8Base64(transactions: CsvTransaction[]): string {
  const csvText = buildCsvText(transactions);
  const encoder = new TextEncoder();
  return bytesToBase64(encoder.encode(csvText));
}
