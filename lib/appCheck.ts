import { getApp } from "@react-native-firebase/app";
import appCheck, { initializeAppCheck } from "@react-native-firebase/app-check";

import { buildAppCheckProviderOptions } from "./appCheckConfig";

let appCheckInitPromise: Promise<void> | null = null;

export function initAppCheck(): Promise<void> {
  if (appCheckInitPromise) {
    return appCheckInitPromise;
  }

  const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
  provider.configure(
    buildAppCheckProviderOptions(
      __DEV__,
      process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN,
    ),
  );

  appCheckInitPromise = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  }).then(() => undefined);

  return appCheckInitPromise;
}
