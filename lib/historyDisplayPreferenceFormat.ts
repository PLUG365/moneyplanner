export type HistoryDisplayPreference = {
  /** 当日より後の日付の記録を履歴一覧に出すか。既定は出さない（Issue #13）。 */
  showFutureTransactions: boolean;
};

export const DEFAULT_HISTORY_DISPLAY_PREFERENCE: HistoryDisplayPreference = {
  showFutureTransactions: false,
};

export function parseHistoryDisplayPreference(
  raw: string | null,
): HistoryDisplayPreference | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "showFutureTransactions" in parsed &&
      typeof (parsed as { showFutureTransactions: unknown })
        .showFutureTransactions === "boolean"
    ) {
      return {
        showFutureTransactions: (parsed as { showFutureTransactions: boolean })
          .showFutureTransactions,
      };
    }
  } catch {
    // 壊れたファイルはデフォルト扱い
  }
  return null;
}

export function serializeHistoryDisplayPreference(
  preference: HistoryDisplayPreference,
): string {
  return JSON.stringify({
    showFutureTransactions: preference.showFutureTransactions,
  });
}
