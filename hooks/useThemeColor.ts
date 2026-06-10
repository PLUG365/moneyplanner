/**
 * 配色テーマ（hooks/useAppTheme）に追従するテーマカラー取得フック
 */

import { type AppTheme } from '@/constants/Themes';
import { useAppTheme } from '@/hooks/useAppTheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof Omit<AppTheme, 'id' | 'label' | 'mode'>
) {
  const { colors } = useAppTheme();
  const colorFromProps = props[colors.mode];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
