const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_PATTERN = new RegExp(
  `^[${INVITE_CODE_CHARS}]{${INVITE_CODE_LENGTH}}$`,
);

export function createInviteCode(random = Math.random): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const index = Math.floor(random() * INVITE_CODE_CHARS.length);
    code += INVITE_CODE_CHARS.charAt(index);
  }
  return code;
}

export function createReplacementInviteCode(
  previousCode?: string,
  createCode = createInviteCode,
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
