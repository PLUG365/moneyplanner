import { isThemeId, type ThemeId } from "../constants/Themes";

export function parseThemePreference(raw: string | null): ThemeId | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "themeId" in parsed &&
      isThemeId((parsed as { themeId: unknown }).themeId)
    ) {
      return (parsed as { themeId: ThemeId }).themeId;
    }
  } catch {
    // 壊れたファイルはデフォルト扱い
  }
  return null;
}

export function serializeThemePreference(themeId: ThemeId): string {
  return JSON.stringify({ themeId });
}
