import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, router, useSegments, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { initAppCheck } from "@/lib/appCheck";
import { waitForAppCheckReadiness } from "@/lib/appCheckReadiness";
import { useAuth } from "@/lib/auth";
import { clearHouseholdCache, initFirestore } from "@/lib/firestore";
import { getHouseholdId } from "@/lib/household";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { user, loading: authLoading } = useAuth();
  const [appCheckReady, setAppCheckReady] = useState(false);
  const segments = useSegments();
  const initializedHouseholdRef = useRef<string | null>(null);

  useEffect(() => {
    waitForAppCheckReadiness(initAppCheck).then(({ error }) => {
      if (error) {
        console.warn("Firebase App Check initialization failed", error);
      }
      setAppCheckReady(true);
    });
  }, []);

  useEffect(() => {
    if (authLoading || !loaded || !appCheckReady) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuthScreen = firstSegment === "auth";
    const inHouseholdScreen = firstSegment === "household";

    if (!user) {
      clearHouseholdCache();
      initializedHouseholdRef.current = null;
      // 未ログイン → 認証画面へ
      if (!inAuthScreen) {
        router.replace("/auth" as Href);
      }
    } else {
      // ログイン済み → 世帯チェック
      getHouseholdId()
        .then((householdId) => {
          if (!householdId) {
            clearHouseholdCache();
            initializedHouseholdRef.current = null;
            // 世帯未設定 → 世帯画面へ
            if (!inHouseholdScreen) {
              router.replace("/household" as Href);
            }
            return;
          }

          const initialize =
            initializedHouseholdRef.current === householdId
              ? Promise.resolve()
              : initFirestore().then(() => {
                  initializedHouseholdRef.current = householdId;
                });

          return initialize.then(() => {
            // 世帯設定済み → メイン画面へ
            if (inAuthScreen || inHouseholdScreen) {
              router.replace("/(tabs)");
            }
          });
        })
        .catch(() => {
          clearHouseholdCache();
          initializedHouseholdRef.current = null;
          if (!inHouseholdScreen) {
            router.replace("/household" as Href);
          }
        });
    }
  }, [user, authLoading, loaded, appCheckReady, segments]);

  if (!loaded || authLoading || !appCheckReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="household" options={{ headerShown: false }} />
        <Stack.Screen name="dev-ui-preview" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
