import assert from "node:assert/strict";
import test from "node:test";

import { parseCsvRecords, parseImportCsv } from "./csvImportParse";

const HEADER_V2 = "日付,種別,口座,カテゴリ,内訳,店舗,金額,メモ";
const HEADER_V1 = "日付,種別,口座,カテゴリ,内訳,金額,メモ";

test("parseCsvRecords handles quoted commas, escaped quotes, and embedded newlines", () => {
  const records = parseCsvRecords('a,"b,c","d""e","f\ng"\r\nh,i,j,k\n');
  assert.deepEqual(records, [
    ["a", "b,c", 'd"e', "f\ng"],
    ["h", "i", "j", "k"],
  ]);
});

test("parseCsvRecords strips BOM and handles LF-only line endings", () => {
  const records = parseCsvRecords("\uFEFFa,b\nc,d");
  assert.deepEqual(records, [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("parseImportCsv parses valid 8-column rows", () => {
  const text = [
    HEADER_V2,
    "2026-04-26,支出,家計,食費,夕食,スーパーA,980,弁当",
    "2026-04-27,収入,給与口座,給与,,,250000,",
  ].join("\r\n");

  const { rows, errors } = parseImportCsv(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    line: 2,
    date: "2026-04-26",
    type: "expense",
    accountName: "家計",
    categoryName: "食費",
    breakdownName: "夕食",
    storeName: "スーパーA",
    amount: 980,
    memo: "弁当",
  });
  assert.equal(rows[1].type, "income");
  assert.equal(rows[1].amount, 250000);
});

test("parseImportCsv accepts legacy 7-column header with empty storeName", () => {
  const text = [HEADER_V1, "2026-04-26,支出,家計,食費,夕食,980,メモ"].join(
    "\n",
  );

  const { rows, errors } = parseImportCsv(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].storeName, "");
  assert.equal(rows[0].amount, 980);
});

test("parseImportCsv rejects unknown header", () => {
  const { rows, errors } = parseImportCsv("日付,金額\n2026-01-01,100");
  assert.equal(rows.length, 0);
  assert.deepEqual(errors, [{ line: 1, message: "ヘッダー形式が不正です" }]);
});

test("parseImportCsv reports empty CSV", () => {
  const { errors } = parseImportCsv("");
  assert.deepEqual(errors, [{ line: 1, message: "CSVが空です" }]);
});

test("parseImportCsv reports header-only CSV as no data rows", () => {
  const { errors } = parseImportCsv(`${HEADER_V2}\r\n`);
  assert.deepEqual(errors, [
    { line: 1, message: "取り込むデータ行がありません" },
  ]);
});

test("parseImportCsv rejects non-existent calendar dates", () => {
  const text = [HEADER_V2, "2026-02-30,支出,家計,食費,,,100,"].join("\n");
  const { rows, errors } = parseImportCsv(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 2);
  assert.match(errors[0].message, /日付が不正/);
});

test("parseImportCsv rejects invalid type labels", () => {
  const text = [HEADER_V2, "2026-04-26,振替,家計,食費,,,100,"].join("\n");
  const { errors } = parseImportCsv(text);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /種別が不正/);
});

test("parseImportCsv rejects negative, decimal, and comma amounts", () => {
  const text = [
    HEADER_V2,
    "2026-04-26,支出,家計,食費,,,-100,",
    "2026-04-26,支出,家計,食費,,,10.5,",
    '2026-04-26,支出,家計,食費,,,"1,000",',
  ].join("\n");

  const { rows, errors } = parseImportCsv(text);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 3);
  assert.deepEqual(
    errors.map((e) => e.line),
    [2, 3, 4],
  );
  for (const error of errors) {
    assert.match(error.message, /金額が不正/);
  }
});

test("parseImportCsv accepts zero amount only when memo is present", () => {
  const text = [
    HEADER_V2,
    "2026-04-26,支出,家計,食費,,,0,残高調整",
    "2026-04-26,支出,家計,食費,,,0,",
  ].join("\n");

  const { rows, errors } = parseImportCsv(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 0);
  assert.equal(rows[0].memo, "残高調整");
  assert.deepEqual(errors, [
    { line: 3, message: "金額0の行はメモが必要です" },
  ]);
});

test("parseImportCsv reports wrong column count with line number", () => {
  const text = [HEADER_V2, "2026-04-26,支出,家計,食費,100"].join("\n");
  const { errors } = parseImportCsv(text);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 2);
  assert.match(errors[0].message, /列数が不正/);
});

test("parseImportCsv collects errors from all rows without stopping", () => {
  const text = [
    HEADER_V2,
    "bad-date,支出,家計,食費,,,100,",
    "2026-04-26,謎,家計,食費,,,100,",
    "2026-04-26,支出,家計,食費,,,abc,",
  ].join("\n");

  const { rows, errors } = parseImportCsv(text);
  assert.equal(rows.length, 0);
  assert.deepEqual(
    errors.map((e) => e.line),
    [2, 3, 4],
  );
});

test("parseImportCsv allows empty account/category/breakdown/store/memo", () => {
  const text = [HEADER_V2, "2026-04-26,支出,,,,,500,"].join("\n");
  const { rows, errors } = parseImportCsv(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accountName, "");
  assert.equal(rows[0].categoryName, "");
  assert.equal(rows[0].breakdownName, "");
  assert.equal(rows[0].storeName, "");
  assert.equal(rows[0].memo, "");
});

test("parseImportCsv skips blank lines while preserving line numbers", () => {
  const text = [
    HEADER_V2,
    "",
    "2026-04-26,支出,家計,食費,,,100,",
    "",
  ].join("\n");

  const { rows, errors } = parseImportCsv(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].line, 3);
});

test("parseImportCsv trims surrounding whitespace in fields", () => {
  const text = [HEADER_V2, "2026-04-26, 支出 , 家計 , 食費 ,, , 100 , めも "].join(
    "\n",
  );
  const { rows, errors } = parseImportCsv(text);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].type, "expense");
  assert.equal(rows[0].accountName, "家計");
  assert.equal(rows[0].amount, 100);
  assert.equal(rows[0].memo, "めも");
});
