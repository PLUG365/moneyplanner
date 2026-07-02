import * as Crypto from "expo-crypto";

import { createInviteCode } from "./inviteCode";

// expo-crypto の CSPRNG を乱数源にした招待コード生成。
// ネイティブモジュールへ依存するため、純関数テスト対象の inviteCode.ts とは分離する。
export function createSecureInviteCode(): string {
  return createInviteCode((byteCount) => Crypto.getRandomBytes(byteCount));
}
