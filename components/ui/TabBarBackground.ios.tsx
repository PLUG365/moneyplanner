import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function BlurTabBarBackground() {
  const { colors } = useAppTheme();
  return (
    <BlurView
      // アプリ内の配色テーマ（ライト/ダーク）に追従させる
      tint={
        colors.mode === 'dark'
          ? 'systemChromeMaterialDark'
          : 'systemChromeMaterialLight'
      }
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
