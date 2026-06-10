import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultThemeId,
  THEMES,
  type AppTheme,
  type ThemeId,
} from "@/constants/Themes";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  loadThemePreference,
  saveThemePreference,
} from "@/lib/themePreference";

type AppThemeContextValue = {
  themeId: ThemeId;
  colors: AppTheme;
  setThemeId: (themeId: ThemeId) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeId, setThemeIdState] = useState<ThemeId | null>(null);

  useEffect(() => {
    let mounted = true;
    loadThemePreference().then((saved) => {
      if (!mounted) return;
      setThemeIdState((current) => current ?? saved ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeId = useCallback((next: ThemeId) => {
    setThemeIdState(next);
    void saveThemePreference(next);
  }, []);

  const resolvedThemeId = themeId ?? defaultThemeId(systemScheme);

  const value = useMemo(
    () => ({
      themeId: resolvedThemeId,
      colors: THEMES[resolvedThemeId],
      setThemeId,
    }),
    [resolvedThemeId, setThemeId],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (context) return context;
  // Provider外（テスト等）では端末設定ベースのデフォルトを返す
  return {
    themeId: defaultThemeId(null),
    colors: THEMES[defaultThemeId(null)],
    setThemeId: () => {},
  };
}
