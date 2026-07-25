import * as FileSystem from "expo-file-system/legacy";

import type { DataVersion } from "./readFreshness";

/**
 * スコープ（集計の年・履歴の日付範囲など）ごとに「最後にサーバーから読んだ時点の
 * データバージョン（マーカー値）」を端末に永続化する。
 *
 * Firestore のオフライン永続化はデータ本体をディスクに保持するが、その「いつ時点の同期か」は
 * 我々のマーカーと結びついていない。そこで本ストアでスコープ→バージョンを永続化し、
 * 再起動後も「ディスクキャッシュの版」を正しく比較できるようにする（案B）。
 *
 * 保存するのはバージョン文字列のみ（取引データ本体は Firestore のキャッシュが保持）。
 */
const FILE_PATH = `${FileSystem.documentDirectory}scopeVersions.json`;
const WRITE_DEBOUNCE_MS = 1500;

/**
 * 保存する内容。`docCount` はサーバー全件読み時点の**生のDoc件数**
 * （ソフトデリート除外前）で、Firestore の LRU GC によるキャッシュ退避の
 * 検出に使う（ADR の R3）。差分読みで更新した場合は再計算できないため未記録にする。
 */
type ScopeStamp = {
  version: string;
  docCount?: number;
};

let versions: Record<string, ScopeStamp> = {};
let loadPromise: Promise<void> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 保存済みの値を現行形式へ寄せる。
 * 旧形式（`Record<string, string>`）で保存されたファイルは、件数未記録として読む。
 */
function normalizeStamp(value: unknown): ScopeStamp | null {
  if (typeof value === "string") return { version: value };
  if (value && typeof value === "object") {
    const record = value as { version?: unknown; docCount?: unknown };
    if (typeof record.version !== "string") return null;
    return typeof record.docCount === "number"
      ? { version: record.version, docCount: record.docCount }
      : { version: record.version };
  }
  return null;
}

/** 起動後の初回アクセス時にファイルから読み込む（以降はメモリを参照）。冪等。 */
export function loadScopeVersions(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const text = await FileSystem.readAsStringAsync(FILE_PATH);
        const parsed = JSON.parse(text);
        versions = {};
        if (parsed && typeof parsed === "object") {
          for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
          )) {
            const stamp = normalizeStamp(value);
            if (stamp) versions[key] = stamp;
          }
        }
      } catch {
        // ファイル未作成・破損時は空で開始
        versions = {};
      }
    })();
  }
  return loadPromise;
}

export function getPersistedScopeVersion(key: string): DataVersion {
  return Object.prototype.hasOwnProperty.call(versions, key)
    ? versions[key].version
    : null;
}

/**
 * stamp 時に記録した生のDoc件数。未記録なら `undefined`。
 *
 * 旧形式のファイルから読んだエントリと、差分読みで更新したエントリは未記録になる。
 * その場合はキャッシュ退避の検出を行わない（＝現行どおりの挙動）。既存利用者に
 * アップグレード直後の全件再読み込みを強いないための選択であり、次に全件サーバー
 * 読みが走った時点で記録され、以後は検出が有効になる。
 */
export function getPersistedScopeDocCount(key: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(versions, key)
    ? versions[key].docCount
    : undefined;
}

export function setPersistedScopeVersion(
  key: string,
  version: DataVersion,
  docCount?: number,
): void {
  if (version == null) return; // マーカー未作成（null）は記録しない
  const previous = versions[key];
  if (previous?.version === version && previous.docCount === docCount) return;
  versions[key] =
    docCount === undefined ? { version } : { version, docCount };
  scheduleWrite();
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void FileSystem.writeAsStringAsync(
      FILE_PATH,
      JSON.stringify(versions),
    ).catch(() => undefined);
  }, WRITE_DEBOUNCE_MS);
}

/** サインアウト・世帯切替時などにクリアしたい場合用。 */
export function clearScopeVersions(): void {
  versions = {};
  scheduleWrite();
}
