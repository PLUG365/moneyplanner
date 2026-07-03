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
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In: identityToken が取得できませんでした");
  }

  return AppleAuthProvider.credential(
    credential.identityToken,
    credential.authorizationCode ?? undefined,
  );
}

/**
 * 現在のユーザーをApple Sign-Inで再認証する
 */
export async function reauthenticateCurrentUserWithApple(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("ログインしていません");
  }

  const appleCredential = await createAppleAuthCredential();
  await reauthenticateWithCredential(user, appleCredential);
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
