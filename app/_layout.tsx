import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/lib/auth';
import { getHouseholdId } from '@/lib/household';
import '@/lib/database'; // モジュールロード時にinitDatabase()が自動実行される（Phase 3完了まで維持）

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (authLoading || !loaded) return;

    const inAuthScreen = segments[0] === 'auth';
    const inHouseholdScreen = segments[0] === 'household';

    if (!user) {
      // 未ログイン → 認証画面へ
      if (!inAuthScreen) {
        router.replace('/auth');
      }
    } else {
      // ログイン済み → 世帯チェック
      getHouseholdId().then((householdId) => {
        if (!householdId) {
          // 世帯未設定 → 世帯画面へ
          if (!inHouseholdScreen) {
            router.replace('/household');
          }
        } else {
          // 世帯設定済み → メイン画面へ
          if (inAuthScreen || inHouseholdScreen) {
            router.replace('/(tabs)');
          }
        }
      });
    }
  }, [user, authLoading, loaded, segments]);

  if (!loaded || authLoading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="household" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
