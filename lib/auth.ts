import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";

/**
 * Apple Sign-In でログイン
 */
export async function signInWithApple(): Promise<FirebaseAuthTypes.UserCredential> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In: identityToken が取得できませんでした");
  }

  const appleCredential = auth.AppleAuthProvider.credential(
    credential.identityToken,
    credential.authorizationCode ?? undefined,
  );

  return auth().signInWithCredential(appleCredential);
}

/**
 * ログアウト
 */
export async function signOut(): Promise<void> {
  await auth().signOut();
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser(): FirebaseAuthTypes.User | null {
  return auth().currentUser;
}

/**
 * 認証状態を監視するReactフック
 */
export function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(
    auth().currentUser,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
