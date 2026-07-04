export const ACCOUNT_DELETION_CONFIRMATION_TEXT = "全データ削除";

// 世帯削除時に先行削除するサブコレクション。
// "members" は含めない: 先に消すと Security Rules の activeMember 判定
// （自分の member ドキュメントの存在が条件）が偽になり、以降の削除が
// すべて permission-denied になる（build 26 発見事項 #2/#3）。
// members と世帯ドキュメントは最後に1バッチで削除する。
const HOUSEHOLD_DELETION_COLLECTION_NAMES = [
  "transactions",
  "accounts",
  "budgets",
  "stores",
  "storeCategoryUsage",
  "breakdowns",
  "categories",
  "joinRequests",
  "meta",
] as const;

export function isAccountDeletionConfirmationValid(input: string): boolean {
  return input.trim() === ACCOUNT_DELETION_CONFIRMATION_TEXT;
}

export function getHouseholdDeletionCollectionNames(): string[] {
  return [...HOUSEHOLD_DELETION_COLLECTION_NAMES];
}
