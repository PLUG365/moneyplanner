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

let versions: Record<string, string> = {};
let loadPromise: Promise<void> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/** 起動後の初回アクセス時にファイルから読み込む（以降はメモリを参照）。冪等。 */
export function loadScopeVersions(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const text = await FileSystem.readAsStringAsync(FILE_PATH);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          versions = parsed as Record<string, string>;
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
    ? versions[key]
    : null;
}

export function setPersistedScopeVersion(
  key: string,
  version: DataVersion,
): void {
  if (version == null) return; // マーカー未作成（null）は記録しない
  if (versions[key] === version) return;
  versions[key] = version;
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
