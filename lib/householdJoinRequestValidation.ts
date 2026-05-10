const MAX_JOIN_DISPLAY_NAME_LENGTH = 20;
const RESERVED_JOIN_DISPLAY_NAMES = new Set([
  "自分",
  "管理者",
  "運営",
  "admin",
  "administrator",
  "system",
]);

export function normalizeJoinDisplayName(value: string): string {
  return value.trim();
}

function normalizeForComparison(value: string): string {
  return value.trim().toLowerCase();
}

export function validateJoinDisplayName(name: string): string | null {
  const normalized = normalizeJoinDisplayName(name);
  if (!normalized) {
    return "ニックネームを入力してください";
  }
  if (normalized.length > MAX_JOIN_DISPLAY_NAME_LENGTH) {
    return "ニックネームは20文字以内で入力してください";
  }
  if (RESERVED_JOIN_DISPLAY_NAMES.has(normalizeForComparison(normalized))) {
    return "そのニックネームは利用できません";
  }
  return null;
}
