import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, router, useSegments, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";

import { AppThemeProvider, useAppTheme } from "@/hooks/useAppTheme";
import { clearStoreSourceCache } from "@/hooks/useCachedStoreOptions";
import { HistoryDisplayPreferenceProvider } from "@/hooks/useHistoryDisplayPreference";
import { initAppCheck } from "@/lib/appCheck";
import { waitForAppCheckReadiness } from "@/lib/appCheckReadiness";
import { useAuth } from "@/lib/auth";
import { clearHouseholdCache, initFirestore } from "@/lib/firestore";
import { getHouseholdId } from "@/lib/household";
import { retryHouseholdResolution } from "@/lib/householdStartupResolution";

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <HistoryDisplayPreferenceProvider>
        <RootLayoutContent />
      </HistoryDisplayPreferenceProvider>
    </AppThemeProvider>
  );
}

function RootLayoutContent() {
  const { colors } = useAppTheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid;
  const [appCheckReady, setAppCheckReady] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolvedHouseholdId, setResolvedHouseholdId] = useState<
    string | null | undefined
  >(undefined);
  const [startupRetryEpoch, setStartupRetryEpoch] = useState(0);
  const [startupError, setStartupError] = useState(false);
  const segments = useSegments();
  const initializedHouseholdRef = useRef<{
    userId: string;
    householdId: string;
  } | null>(null);
  const startupGenerationRef = useRef(0);
  const deferredRetryCountRef = useRef(0);
  const deferredRetryUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    waitForAppCheckReadiness(initAppCheck).then(({ error }) => {
      if (error) {
        console.warn("Firebase App Check initialization failed");
      }
      if (active) setAppCheckReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const generation = startupGenerationRef.current + 1;
    startupGenerationRef.current = generation;
    let cancelled = false;
    let deferredRetryTimer: ReturnType<typeof setTimeout> | undefined;
    const shortRetryTimers = new Map<
      ReturnType<typeof setTimeout>,
      () => void
    >();
    const isCurrent = () =>
      !cancelled && startupGenerationRef.current === generation;

    const clearTimers = () => {
      if (deferredRetryTimer) clearTimeout(deferredRetryTimer);
      for (const [timer, resolve] of shortRetryTimers) {
        clearTimeout(timer);
        resolve();
      }
      shortRetryTimers.clear();
    };

    if (authLoading || !loaded || !appCheckReady) {
      return () => {
        cancelled = true;
        clearTimers();
      };
    }

    if (!userId) {
      setResolvedUserId(null);
      setResolvedHouseholdId(undefined);
      setStartupError(false);
      clearHouseholdCache();
      clearStoreSourceCache();
      initializedHouseholdRef.current = null;
      deferredRetryCountRef.current = 0;
      deferredRetryUserIdRef.current = null;
      // 未ログイン → 認証画面へ
      return () => {
        cancelled = true;
        clearTimers();
      };
    }

    setResolvedUserId(null);
    setResolvedHouseholdId(undefined);
    setStartupError(false);
    const currentUserId = userId;
    if (deferredRetryUserIdRef.current !== currentUserId) {
      deferredRetryCountRef.current = 0;
      deferredRetryUserIdRef.current = currentUserId;
    }

    const waitBrieflyBeforeRetry = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          shortRetryTimers.delete(timer);
          resolve();
        }, 250);
        shortRetryTimers.set(timer, resolve);
      });

    const resolveStartup = async () => {
      try {
        // ログイン済み → 世帯チェック。読み取り例外は未所属へ変換しない。
        const householdId = await retryHouseholdResolution(
          getHouseholdId,
          3,
          waitBrieflyBeforeRetry,
        );
        if (!isCurrent()) return;

        if (!householdId) {
          clearHouseholdCache();
          initializedHouseholdRef.current = null;
          deferredRetryCountRef.current = 0;
          setResolvedHouseholdId(null);
          setResolvedUserId(currentUserId);
          return;
        }

        const initialized = initializedHouseholdRef.current;
        if (
          initialized?.userId !== currentUserId ||
          initialized.householdId !== householdId
        ) {
          await initFirestore();
          if (!isCurrent()) return;
          initializedHouseholdRef.current = {
            userId: currentUserId,
            householdId,
          };
        }

        deferredRetryCountRef.current = 0;
        setResolvedHouseholdId(householdId);
        setResolvedUserId(currentUserId);
      } catch {
        if (!isCurrent()) return;

        console.warn("Household startup resolution failed; retrying safely");
        // 失敗を /household に変換しない。有限回の遅延再試行中も Root を保留する。
        if (deferredRetryCountRef.current < 3) {
          deferredRetryCountRef.current += 1;
          deferredRetryTimer = setTimeout(() => {
            if (isCurrent()) setStartupRetryEpoch((value) => value + 1);
          }, 2000);
        } else {
          setStartupError(true);
        }
      }
    };

    void resolveStartup();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [userId, authLoading, loaded, appCheckReady, startupRetryEpoch]);

  useEffect(() => {
    if (authLoading || !loaded || !appCheckReady) return;

    const firstSegment = segments[0] as string | undefined;
    if (!user) {
      if (firstSegment !== "auth") router.replace("/auth" as Href);
      return;
    }

    if (resolvedUserId !== user.uid || resolvedHouseholdId === undefined)
      return;
    if (resolvedHouseholdId === null) {
      if (firstSegment !== "household") router.replace("/household" as Href);
    } else if (firstSegment === "auth" || firstSegment === "household") {
      router.replace("/(tabs)");
    }
  }, [
    appCheckReady,
    authLoading,
    loaded,
    resolvedHouseholdId,
    resolvedUserId,
    segments,
    user,
  ]);

  const retryStartupResolution = () => {
    deferredRetryCountRef.current = 0;
    setStartupError(false);
    setStartupRetryEpoch((value) => value + 1);
  };

  if (!loaded || authLoading || !appCheckReady) {
    return null;
  }

  if (startupError && user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          世帯情報を確認できません
        </Text>
        <Text style={[styles.errorMessage, { color: colors.text }]}>
          通信状況を確認して、もう一度お試しください。
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={retryStartupResolution}
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
        >
          <Text style={styles.retryButtonText}>再試行</Text>
        </Pressable>
      </View>
    );
  }

  if (!!user && resolvedUserId !== user.uid) {
    return null;
  }

  return (
    <ThemeProvider value={colors.mode === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="household" options={{ headerShown: false }} />
        <Stack.Screen name="dev-ui-preview" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colors.mode === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
