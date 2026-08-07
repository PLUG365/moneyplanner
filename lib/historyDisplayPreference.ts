import * as FileSystem from "expo-file-system/legacy";

import {
  parseHistoryDisplayPreference,
  serializeHistoryDisplayPreference,
  type HistoryDisplayPreference,
} from "@/lib/historyDisplayPreferenceFormat";

const HISTORY_DISPLAY_PREFERENCE_FILE = "history-display-preference.json";

function preferenceFileUri(): string {
  return `${FileSystem.documentDirectory}${HISTORY_DISPLAY_PREFERENCE_FILE}`;
}

export async function loadHistoryDisplayPreference(): Promise<HistoryDisplayPreference | null> {
  try {
    const info = await FileSystem.getInfoAsync(preferenceFileUri());
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(preferenceFileUri());
    return parseHistoryDisplayPreference(raw);
  } catch {
    return null;
  }
}

export async function saveHistoryDisplayPreference(
  preference: HistoryDisplayPreference,
): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      preferenceFileUri(),
      serializeHistoryDisplayPreference(preference),
    );
  } catch {
    // 保存失敗は致命的でないため無視（次回起動時はデフォルト）
  }
}
