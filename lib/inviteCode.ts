export const INVITE_CODE_LENGTH = 10;
const LEGACY_INVITE_CODE_LENGTH = 6;
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// 新規発行は10文字。既存の6文字コードは有効期限内は参加に使えるため受理する。
const INVITE_CODE_PATTERN = new RegExp(
  `^[${INVITE_CODE_CHARS}]{${INVITE_CODE_LENGTH}}$|^[${INVITE_CODE_CHARS}]{${LEGACY_INVITE_CODE_LENGTH}}$`,
);
export const INVITE_CODE_EXPIRY_DAYS = 30;

type InviteCodeTimestampLike =
  | Date
  | number
  | string
  | { toMillis?: () => number; toDate?: () => Date }
  | null
  | undefined;

export type InviteCodeState = "active" | "expired" | "disabled";

export type RandomBytesFn = (byteCount: number) => Uint8Array;

// randomBytes には暗号論的に安全な乱数源（expo-crypto の getRandomBytes）を渡す。
// Math.random は予測可能なため招待コード生成に使わない。
// INVITE_CODE_CHARS は32文字（256の約数）のため、byte % 32 に剰余バイアスは生じない。
export function createInviteCode(randomBytes: RandomBytesFn): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const index = bytes[i] % INVITE_CODE_CHARS.length;
    code += INVITE_CODE_CHARS.charAt(index);
  }
  return code;
}

export function createReplacementInviteCode(
  previousCode: string | undefined,
  createCode: () => string,
  maxAttempts = 10,
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = createCode();
    if (code !== previousCode) {
      return code;
    }
  }

  throw new Error("招待コードを生成できませんでした");
}

export function isInviteCodeFormat(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

export function buildInviteCodeExpiryDate(
  baseDate = new Date(),
  expiryDays = INVITE_CODE_EXPIRY_DAYS,
): Date {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + expiryDays);
  return date;
}

function toEpochMs(value: InviteCodeTimestampLike): number | null {
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

export function resolveInviteCodeState(
  inviteCodeData: {
    expiresAt?: InviteCodeTimestampLike;
    disabledAt?: InviteCodeTimestampLike;
  },
  nowMs = Date.now(),
): InviteCodeState {
  const disabledAtMs = toEpochMs(inviteCodeData.disabledAt);
  if (disabledAtMs !== null) {
    return "disabled";
  }

  const expiresAtMs = toEpochMs(inviteCodeData.expiresAt);
  if (expiresAtMs !== null && expiresAtMs <= nowMs) {
    return "expired";
  }

  return "active";
}
