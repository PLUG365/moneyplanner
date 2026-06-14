import assert from "node:assert/strict";
import test from "node:test";

import { decodeCsvTextFromBase64 } from "./csvEncoding";

type EncodingJapaneseModule = {
  convert(
    data: ArrayLike<number>,
    options: {
      to: "UNICODE" | "SJIS";
      from: "UNICODE" | "SJIS";
      type?: "array";
    },
  ): number[];
};

const EncodingJapanese: EncodingJapaneseModule = require("encoding-japanese");

function utf16LeBase64(text: string): string {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return Buffer.from(bytes).toString("base64");
}

test("decodeCsvTextFromBase64 decodes UTF-8 BOM CSV", () => {
  const csv = "\uFEFF日付,種別\r\n2026-06-14,支出\r\n";
  const b64 = Buffer.from(new TextEncoder().encode(csv)).toString("base64");

  const decoded = decodeCsvTextFromBase64(b64);
  assert.equal(decoded, "日付,種別\r\n2026-06-14,支出\r\n");
});

test("decodeCsvTextFromBase64 decodes UTF-16LE BOM CSV", () => {
  const csv = "日付,種別\r\n2026-06-14,収入\r\n";
  const b64 = utf16LeBase64(csv);

  const decoded = decodeCsvTextFromBase64(b64);
  assert.equal(decoded, csv);
});

test("decodeCsvTextFromBase64 falls back to Shift_JIS when UTF-8 is broken", () => {
  const source = "日付,種別\r\n2026-06-14,支出\r\n";
  const sjisBytes = EncodingJapanese.convert(source, {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  const b64 = Buffer.from(sjisBytes).toString("base64");

  const decoded = decodeCsvTextFromBase64(b64);
  assert.equal(decoded, source);
});

test("decodeCsvTextFromBase64 returns null for undecodable binary", () => {
  const b64 = Buffer.from([0x81]).toString("base64");

  const decoded = decodeCsvTextFromBase64(b64);
  assert.equal(decoded, null);
});
