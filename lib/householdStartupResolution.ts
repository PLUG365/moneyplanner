export type HouseholdMembershipInput = {
  user: {
    exists: boolean;
    householdId?: unknown;
    fromCache: boolean;
  };
  member?: {
    exists: boolean;
    active: boolean;
    fromCache: boolean;
  };
};

export type HouseholdMembershipResolution =
  | { kind: "member"; householdId: string }
  | { kind: "unaffiliated" }
  | { kind: "indeterminate" };

export class HouseholdMembershipIndeterminateError extends Error {
  constructor() {
    super("世帯所属をサーバーで確認できませんでした");
    this.name = "HouseholdMembershipIndeterminateError";
  }
}

export function resolveHouseholdMembership(
  input: HouseholdMembershipInput,
): HouseholdMembershipResolution {
  if (!input.user.exists) {
    return input.user.fromCache
      ? { kind: "indeterminate" }
      : { kind: "unaffiliated" };
  }

  const householdId = input.user.householdId;
  if (typeof householdId !== "string" || householdId.length === 0) {
    return input.user.fromCache
      ? { kind: "indeterminate" }
      : { kind: "unaffiliated" };
  }

  if (!input.member) return { kind: "indeterminate" };
  if (input.member.exists && input.member.active) {
    return { kind: "member", householdId };
  }

  return input.member.fromCache
    ? { kind: "indeterminate" }
    : { kind: "unaffiliated" };
}

export async function retryHouseholdResolution<T>(
  resolve: () => Promise<T>,
  maxAttempts: number,
  waitBeforeRetry: () => Promise<void> = async () => {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await resolve();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await waitBeforeRetry();
    }
  }

  throw lastError;
}
