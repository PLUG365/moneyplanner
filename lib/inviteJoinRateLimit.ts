const INVITE_JOIN_FAILURE_LIMIT = 5;
const INVITE_JOIN_COOLDOWN_MINUTES = 10;

type TimestampLike =
  | Date
  | number
  | string
  | { toMillis?: () => number; toDate?: () => Date }
  | null
  | undefined;

export type InviteJoinAttemptState = {
  failedAttempts: number;
  cooldownUntilMs: number | null;
};

function toEpochMs(value: TimestampLike): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : null;
    }
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return date instanceof Date ? date.getTime() : null;
    }
  }
  return null;
}

export function parseInviteJoinAttemptState(data: {
  inviteJoinFailedAttempts?: unknown;
  inviteJoinCooldownUntil?: TimestampLike;
}): InviteJoinAttemptState {
  const failedAttemptsRaw = Number(data.inviteJoinFailedAttempts ?? 0);
  const failedAttempts =
    Number.isFinite(failedAttemptsRaw) && failedAttemptsRaw > 0
      ? Math.floor(failedAttemptsRaw)
      : 0;

  return {
    failedAttempts,
    cooldownUntilMs: toEpochMs(data.inviteJoinCooldownUntil),
  };
}

export function getInviteJoinCooldownRemainingMs(
  state: InviteJoinAttemptState,
  nowMs = Date.now(),
): number {
  if (state.cooldownUntilMs == null) return 0;
  return Math.max(0, state.cooldownUntilMs - nowMs);
}

export function isInviteJoinCooldownActive(
  state: InviteJoinAttemptState,
  nowMs = Date.now(),
): boolean {
  return getInviteJoinCooldownRemainingMs(state, nowMs) > 0;
}

export function buildInviteJoinFailurePatch(
  state: InviteJoinAttemptState,
  now = new Date(),
): { failedAttempts: number; cooldownUntil: Date | null } {
  const nextFailedAttempts = state.failedAttempts + 1;
  if (nextFailedAttempts < INVITE_JOIN_FAILURE_LIMIT) {
    return {
      failedAttempts: nextFailedAttempts,
      cooldownUntil: null,
    };
  }

  const cooldownUntil = new Date(now);
  cooldownUntil.setMinutes(
    cooldownUntil.getMinutes() + INVITE_JOIN_COOLDOWN_MINUTES,
  );

  return {
    failedAttempts: 0,
    cooldownUntil,
  };
}

export function buildInviteJoinResetPatch(): {
  failedAttempts: number;
  cooldownUntil: null;
} {
  return {
    failedAttempts: 0,
    cooldownUntil: null,
  };
}
