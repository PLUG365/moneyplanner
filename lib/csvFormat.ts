export type CsvTransaction = {
  date: string;
  type: "income" | "expense";
  accountName: string;
  categoryName: string;
  breakdownName: string;
  storeName: string;
  amount: number;
  memo: string;
};

/** Excel等が数式として解釈しうる先頭文字（CSVインジェクション対策の対象）。 */
const FORMULA_LEADING_CHARS = ["=", "+", "-", "@", "\t", "\r"];

function startsWithFormulaChar(value: string): boolean {
  return value.length > 0 && FORMULA_LEADING_CHARS.includes(value[0]);
}

/** 数式開始文字で始まるフィールドにシングルクォートを前置して無害化する。
 *  インポート側は stripCsvFormulaGuard で除去するため往復で値は保たれる。 */
export function guardCsvFormulaField(value: string): string {
  return startsWithFormulaChar(value) ? `'${value}` : value;
}

/** guardCsvFormulaField で付与された接頭辞を除去する（インポート往復整合用）。
 *  「' + 数式開始文字」の並びのみ除去するため、元からシングルクォートで
 *  始まる通常の値には影響しない。 */
export function stripCsvFormulaGuard(value: string): string {
  if (value.startsWith("'") && startsWithFormulaChar(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

function escapeCsvField(value: string): string {
  const normalized = guardCsvFormulaField(
    (value ?? "").replace(/\r?\n/g, " "),
  );
  if (normalized.includes(",") || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildCsvText(transactions: CsvTransaction[]): string {
  const header = "日付,種別,口座,カテゴリ,内訳,店舗,金額,メモ";
  const rows = transactions.map((t) => {
    const type = t.type === "income" ? "収入" : "支出";
    return [
      t.date,
      type,
      escapeCsvField(t.accountName ?? ""),
      escapeCsvField(t.categoryName ?? ""),
      escapeCsvField(t.breakdownName ?? ""),
      escapeCsvField(t.storeName ?? ""),
      String(t.amount),
      escapeCsvField(t.memo ?? ""),
    ].join(",");
  });

  // BOM + CRLF for Excel compatibility.
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}

function toUtf16LeBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const codeUnit = text.charCodeAt(i);
    bytes[i * 2] = codeUnit & 0xff;
    bytes[i * 2 + 1] = (codeUnit >> 8) & 0xff;
  }
  return bytes;
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

/** Excel互換性を優先したCSV(base64)を返す。
 *  UTF-16LE BOM(FF FE)で書き出すことで、Windows Excelの直接オープン時の
 *  日本語文字化けを避ける。 */
export function buildCsvExcelBase64(transactions: CsvTransaction[]): string {
  const csvText = buildCsvText(transactions);
  const content = csvText.startsWith("\uFEFF") ? csvText.slice(1) : csvText;
  const bodyBytes = toUtf16LeBytes(content);
  const bytes = new Uint8Array(bodyBytes.length + 2);
  // UTF-16LE BOM: FF FE
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  bytes.set(bodyBytes, 2);
  return bytesToBase64(bytes);
}
