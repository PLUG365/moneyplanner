export type HouseholdMemberDoc = {
  displayName?: string | null;
  joinedAt?: unknown;
  removedAt?: unknown;
};

export type NormalizedHouseholdMember = {
  uid: string;
  displayName: string;
  removed: boolean;
};

export function isActiveHouseholdMember(
  data: HouseholdMemberDoc | null | undefined,
): boolean {
  return !!data && data.removedAt == null;
}

export function mapHouseholdMember(
  uid: string,
  data: HouseholdMemberDoc | null | undefined,
): NormalizedHouseholdMember {
  return {
    uid,
    displayName: data?.displayName?.trim() || "メンバー",
    removed: !isActiveHouseholdMember(data),
  };
}
