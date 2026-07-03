import { getApp } from "@react-native-firebase/app";
import * as appCheckModule from "@react-native-firebase/app-check";
import {
    initializeAppCheck,
    type ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";

import { buildAppCheckProviderOptions } from "./appCheckConfig";

// パッケージルートが ReactNativeFirebaseAppCheckProvider を「型」として再エクスポート
// しており、名前でimportするとクラス実体（値）に解決されない。実行時には値が
// エクスポートされているため、名前空間import経由でコンストラクタを取り出す。
const ProviderCtor = (
  appCheckModule as unknown as {
    ReactNativeFirebaseAppCheckProvider: new () => ReactNativeFirebaseAppCheckProvider;
  }
).ReactNativeFirebaseAppCheckProvider;

let appCheckInitPromise: Promise<void> | null = null;

export function initAppCheck(): Promise<void> {
  if (appCheckInitPromise) {
    return appCheckInitPromise;
  }

  const provider = new ProviderCtor();
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
