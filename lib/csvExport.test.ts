import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCsvExcelBase64,
    buildCsvText,
    buildCsvUtf8Base64,
    type CsvTransaction,
} from "./csvFormat";

test("buildCsvText emits UTF-8 BOM and CRLF rows for Excel", () => {
  const tx: CsvTransaction = {
    date: "2026-03-30",
    amount: 1200,
    type: "expense",
    accountName: "家計",
    categoryName: "食費",
    breakdownName: "晩ご飯",
    storeName: "スーパーA",
    memo: "スーパー",
  };

  const csv = buildCsvText([tx]);

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /^\uFEFF日付,種別,口座,カテゴリ,内訳,店舗,金額,メモ\r\n/);
  assert.match(
    csv,
    /2026-03-30,支出,家計,食費,晩ご飯,スーパーA,1200,スーパー\r\n$/,
  );
});

test("buildCsvText quotes fields containing comma or quote", () => {
  const tx: CsvTransaction = {
    date: "2026-03-30",
    amount: 500,
    type: "income",
    accountName: "現金,財布",
    categoryName: "臨時収入",
    breakdownName: "",
    storeName: "",
    memo: '"特別"ボーナス',
  };

  const csv = buildCsvText([tx]);

  assert.match(csv, /"現金,財布"/);
  assert.match(csv, /"""特別""ボーナス"/);
});

test("buildCsvUtf8Base64 emits UTF-8 BOM bytes (EF BB BF)", () => {
  const tx: CsvTransaction = {
    date: "2026-03-30",
    amount: 1200,
    type: "expense",
    accountName: "家計",
    categoryName: "食費",
    breakdownName: "晩ご飯",
    storeName: "",
    memo: "スーパー",
  };

  const b64 = buildCsvUtf8Base64([tx]);
  const buf = Buffer.from(b64, "base64");

  // UTF-8 BOM: EF BB BF
  assert.equal(buf[0], 0xef);
  assert.equal(buf[1], 0xbb);
  assert.equal(buf[2], 0xbf);
});

test("buildCsvExcelBase64 emits UTF-16LE BOM bytes (FF FE)", () => {
  const tx: CsvTransaction = {
    date: "2026-03-30",
    amount: 1200,
    type: "expense",
    accountName: "家計",
    categoryName: "食費",
    breakdownName: "晩ご飯",
    storeName: "スーパーA",
    memo: "スーパー",
  };

  const b64 = buildCsvExcelBase64([tx]);
  const buf = Buffer.from(b64, "base64");

  // UTF-16LE BOM: FF FE
  assert.equal(buf[0], 0xff);
  assert.equal(buf[1], 0xfe);
});
