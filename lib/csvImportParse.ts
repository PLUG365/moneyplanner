import { stripCsvFormulaGuard } from "./csvFormat";
import { MAX_TRANSACTION_AMOUNT } from "./transactionAmountValidation";

export type CsvImportError = {
  line: number;
  message: string;
};

export type ParsedImportRow = {
  line: number;
  date: string;
  type: "income" | "expense";
  accountName: string;
  categoryName: string;
  breakdownName: string;
  storeName: string;
  amount: number;
  memo: string;
};

export type CsvImportParseResult = {
  rows: ParsedImportRow[];
  errors: CsvImportError[];
};

const HEADER_V1 = "日付,種別,口座,カテゴリ,内訳,金額,メモ";
const HEADER_V2 = "日付,種別,口座,カテゴリ,内訳,店舗,金額,メモ";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_PATTERN = /^\d+$/;

/** RFC4180 準拠のフィールド分割。引用符内のカンマ・改行・"" エスケープに対応。 */
export function parseCsvRecords(text: string): string[][] {
  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    fields.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(fields);
    fields = [];
  };

  while (i < source.length) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      i += 1;
    } else if (ch === "\r" && source[i + 1] === "\n") {
      pushRecord();
      i += 2;
    } else if (ch === "\n" || ch === "\r") {
      pushRecord();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== "" || fields.length > 0) {
    pushRecord();
  }

  // 完全に空の行（空行・末尾改行由来）は除外。ただし行番号維持のためここでは除外せず呼び出し側で判定する。
  return records;
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isEmptyRecord(record: string[]): boolean {
  return record.every((field) => field.trim() === "");
}

export function parseImportCsv(text: string): CsvImportParseResult {
  const records = parseCsvRecords(text);
  const errors: CsvImportError[] = [];
  const rows: ParsedImportRow[] = [];

  if (records.length === 0 || isEmptyRecord(records[0])) {
    return { rows, errors: [{ line: 1, message: "CSVが空です" }] };
  }

  const header = records[0].map((field) => field.trim()).join(",");
  let hasStoreColumn: boolean;
  if (header === HEADER_V2) {
    hasStoreColumn = true;
  } else if (header === HEADER_V1) {
    hasStoreColumn = false;
  } else {
    return { rows, errors: [{ line: 1, message: "ヘッダー形式が不正です" }] };
  }
  const expectedColumns = hasStoreColumn ? 8 : 7;

  for (let index = 1; index < records.length; index++) {
    const line = index + 1;
    const record = records[index];
    if (isEmptyRecord(record)) continue;

    if (record.length !== expectedColumns) {
      errors.push({
        line,
        message: `列数が不正です（${expectedColumns}列必要、${record.length}列）`,
      });
      continue;
    }

    const [date, typeLabel, accountName, categoryName, breakdownName] = record;
    const storeName = hasStoreColumn ? record[5] : "";
    const amountText = hasStoreColumn ? record[6] : record[5];
    const memo = hasStoreColumn ? record[7] : record[6];

    let hasError = false;

    if (!isValidDate(date.trim())) {
      errors.push({
        line,
        message: "日付が不正です（YYYY-MM-DD形式で入力してください）",
      });
      hasError = true;
    }

    let type: "income" | "expense" | null = null;
    const trimmedType = typeLabel.trim();
    if (trimmedType === "収入") {
      type = "income";
    } else if (trimmedType === "支出") {
      type = "expense";
    } else {
      errors.push({
        line,
        message: "種別が不正です（収入または支出）",
      });
      hasError = true;
    }

    const trimmedAmount = amountText.trim();
    const amount = AMOUNT_PATTERN.test(trimmedAmount)
      ? parseInt(trimmedAmount, 10)
      : NaN;
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({
        line,
        message: "金額が不正です（0以上の整数で入力してください）",
      });
      hasError = true;
    } else if (amount > MAX_TRANSACTION_AMOUNT) {
      // 手入力側（transactionAmountValidation.ts）と同じ上限を適用する。
      errors.push({
        line,
        message: `金額が上限（${MAX_TRANSACTION_AMOUNT.toLocaleString("ja-JP")}円）を超えています`,
      });
      hasError = true;
    } else if (amount === 0 && memo.trim() === "") {
      // アプリ本体の登録ルールに合わせる: 金額0はメモがある場合のみ許可。
      errors.push({
        line,
        message: "金額0の行はメモが必要です",
      });
      hasError = true;
    }

    if (hasError || !type) continue;

    rows.push({
      line,
      date: date.trim(),
      type,
      accountName: stripCsvFormulaGuard(accountName.trim()),
      categoryName: stripCsvFormulaGuard(categoryName.trim()),
      breakdownName: stripCsvFormulaGuard(breakdownName.trim()),
      storeName: stripCsvFormulaGuard(storeName.trim()),
      amount,
      memo: stripCsvFormulaGuard(memo.trim()),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: 1, message: "取り込むデータ行がありません" });
  }

  return { rows, errors };
}
