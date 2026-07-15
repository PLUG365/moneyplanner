import {
  AppleAuthProvider,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";

/**
 * Apple Sign-In でログイン
 */
export async function signInWithApple(): Promise<FirebaseAuthTypes.UserCredential> {
  const appleCredential = await createAppleAuthCredential();

  return signInWithCredential(getAuth(), appleCredential);
}

async function createAppleAuthCredential(): Promise<FirebaseAuthTypes.AuthCredential> {
  const { credential } = await createAppleAuthResult();
  return credential;
}

async function createAppleAuthResult(): Promise<{
  credential: FirebaseAuthTypes.AuthCredential;
  authorizationCode: string | null;
}> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In: identityToken が取得できませんでした");
  }

  return {
    credential: AppleAuthProvider.credential(
      credential.identityToken,
      credential.authorizationCode ?? undefined,
    ),
    authorizationCode: credential.authorizationCode ?? null,
  };
}

/**
 * 現在のユーザーをApple Sign-Inで再認証する。
 * 戻り値はAppleのauthorizationCode（トークン失効用。取得できなければnull）。
 */
export async function reauthenticateCurrentUserWithApple(): Promise<
  string | null
> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("ログインしていません");
  }

  const { credential, authorizationCode } = await createAppleAuthResult();
  await reauthenticateWithCredential(user, credential);
  return authorizationCode;
}

/**
 * アカウント削除前の再認証と、Apple Sign-Inトークンの失効をまとめて行う。
 * トークン失効はSign in with Apple併用アプリのApp Store要件
 * （Guideline 5.1.1(v)）。失効の失敗でアカウント削除自体は止めない
 * （authorizationCodeは有効期限5分・使い捨てのため、失敗時に確実な
 * リトライ手段がなく、削除完了を優先する）。
 */
export async function reauthenticateAndRevokeAppleToken(): Promise<void> {
  const authorizationCode = await reauthenticateCurrentUserWithApple();
  if (!authorizationCode) return;

  try {
    // modular API の revokeAccessToken はネイティブ未実装のため、
    // namespaced の revokeToken を使う
    await getAuth().revokeToken(authorizationCode);
  } catch (error) {
    console.warn("Apple Sign-In トークンの失効に失敗しました", error);
  }
}

/**
 * 現在のFirebase Authアカウントを削除する
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("ログインしていません");
  }

  await deleteUser(user);
}

/**
 * Firebase Authアカウントを削除する。前段の処理（大量データ削除など）で
 * 再認証が失効した場合（auth/requires-recent-login）は、Apple再認証と
 * トークン失効をやり直してもう一度だけ試す（build 26 発見事項 #3 対策）。
 */
export async function deleteCurrentUserAccountWithReauthRetry(): Promise<void> {
  try {
    await deleteCurrentUserAccount();
  } catch (error) {
    if (
      (error as { code?: string })?.code === "auth/requires-recent-login"
    ) {
      await reauthenticateAndRevokeAppleToken();
      await deleteCurrentUserAccount();
    } else {
      throw error;
    }
  }
}

/**
 * ログアウト
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(getAuth());
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return getAuth().currentUser;
}

/**
 * 認証状態を監視するReactフック
 */
export function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(
    getAuth().currentUser,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
