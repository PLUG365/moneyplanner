type EncodingJapaneseModule = {
  convert(
    data: ArrayLike<number>,
    options: {
      to: "UNICODE" | "SJIS";
      from: "UNICODE" | "SJIS";
      type?: "array";
    },
  ): number[];
  codeToString(codes: ArrayLike<number>): string;
};

const EncodingJapanese: EncodingJapaneseModule = require("encoding-japanese");

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, "");
  const binary = globalThis.atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeUtf16Le(bytes: Uint8Array): string {
  let out = "";
  const length = bytes.length - (bytes.length % 2);
  for (let i = 0; i < length; i += 2) {
    out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }
  return out;
}

function arraysEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function decodeShiftJis(bytes: Uint8Array): string | null {
  try {
    const unicodeCodes = EncodingJapanese.convert(bytes, {
      from: "SJIS",
      to: "UNICODE",
      type: "array",
    });
    const text = EncodingJapanese.codeToString(unicodeCodes);
    // 変換に失敗した場合は「?」等へ置き換わるため、SJISへ再エンコードして
    // 元バイト列と一致するかで妥当性を確認する。
    const roundTrip = EncodingJapanese.convert(text, {
      from: "UNICODE",
      to: "SJIS",
      type: "array",
    });
    if (!arraysEqual(roundTrip, bytes)) return null;
    return text;
  } catch {
    return null;
  }
}

/** 読み込んだCSV(base64)をデコードする。
 *  UTF-16LE BOM(FF FE) と UTF-8 BOM(EF BB BF) を優先判定し、
 *  BOMなしはUTF-8として扱う。 */
export function decodeCsvTextFromBase64(base64: string): string | null {
  const bytes = base64ToBytes(base64);

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeUtf16Le(bytes.subarray(2));
  }

  const utf8Decoder = new TextDecoder("utf-8");
  const utf8Bytes =
    bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      ? bytes.subarray(3)
      : bytes;
  const text = utf8Decoder.decode(utf8Bytes);

  // 文字化け検出: 不正バイトを含む場合は U+FFFD が混入する。
  if (!text.includes("\uFFFD")) {
    return text;
  }

  // Windows Excelの「CSV（コンマ区切り）」保存はSJIS/CP932になりやすいため、
  // UTF-8として壊れる場合のみSJISフォールバックで救済する。
  return decodeShiftJis(bytes);
}
