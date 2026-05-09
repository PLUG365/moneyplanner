export const ACCOUNT_DELETION_CONFIRMATION_TEXT = "全データ削除";

const HOUSEHOLD_DELETION_COLLECTION_NAMES = [
  "transactions",
  "accounts",
  "budgets",
  "stores",
  "storeCategoryUsage",
  "breakdowns",
  "categories",
  "members",
] as const;

export function isAccountDeletionConfirmationValid(input: string): boolean {
  return input.trim() === ACCOUNT_DELETION_CONFIRMATION_TEXT;
}

export function getHouseholdDeletionCollectionNames(): string[] {
  return [...HOUSEHOLD_DELETION_COLLECTION_NAMES];
}
