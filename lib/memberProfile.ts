export type ProviderProfile = {
  displayName?: string | null;
  email?: string | null;
};

export type StoredMemberProfile = {
  displayName: string;
};

export function createStoredMemberProfile(
  _profile?: ProviderProfile | null,
): StoredMemberProfile {
  return { displayName: "メンバー" };
}
