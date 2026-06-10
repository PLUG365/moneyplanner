import * as FileSystem from "expo-file-system/legacy";

import { type ThemeId } from "@/constants/Themes";
import {
  parseThemePreference,
  serializeThemePreference,
} from "@/lib/themePreferenceFormat";

const THEME_PREFERENCE_FILE = "theme-preference.json";

function preferenceFileUri(): string {
  return `${FileSystem.documentDirectory}${THEME_PREFERENCE_FILE}`;
}

export async function loadThemePreference(): Promise<ThemeId | null> {
  try {
    const info = await FileSystem.getInfoAsync(preferenceFileUri());
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(preferenceFileUri());
    return parseThemePreference(raw);
  } catch {
    return null;
  }
}

export async function saveThemePreference(themeId: ThemeId): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      preferenceFileUri(),
      serializeThemePreference(themeId),
    );
  } catch {
    // 保存失敗は致命的でないため無視（次回起動時はデフォルト）
  }
}
