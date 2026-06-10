// 配色テーマ定義（ライト2＋ダーク2）
// 視認性基準: text>=7:1, subText>=4.5:1, アクセント>=3.5:1（背景/カード両方）
// 検証はlib/themes.test.tsで自動チェックしている

export type ThemeId =
  | "peony-light"
  | "lavender-light"
  | "peony-dark"
  | "lavender-dark";

export type AppTheme = {
  id: ThemeId;
  label: string;
  mode: "light" | "dark";
  text: string;
  subText: string;
  background: string;
  card: string;
  border: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  income: string;
  expense: string;
  warning: string;
  exceeded: string;
  safe: string;
  track: string;
};

export const THEMES: Record<ThemeId, AppTheme> = {
  "peony-light": {
    id: "peony-light",
    label: "ピオニー",
    mode: "light",
    text: "#4A4140",
    subText: "#796D68",
    background: "#FAF6F3",
    card: "#FFFFFF",
    border: "#F0E2DC",
    tint: "#B4566A",
    icon: "#796D68",
    tabIconDefault: "#796D68",
    tabIconSelected: "#B4566A",
    income: "#54779F",
    expense: "#B4566A",
    warning: "#A66A2E",
    exceeded: "#9E4459",
    safe: "#5E8A5A",
    track: "#EFE7E2",
  },
  "lavender-light": {
    id: "lavender-light",
    label: "ラベンダー",
    mode: "light",
    text: "#46414F",
    subText: "#6E6878",
    background: "#F8F6FB",
    card: "#FFFFFF",
    border: "#E9E3F0",
    tint: "#7E6BB1",
    icon: "#6E6878",
    tabIconDefault: "#6E6878",
    tabIconSelected: "#7E6BB1",
    income: "#5670AE",
    expense: "#AC5577",
    warning: "#A66A2E",
    exceeded: "#93476B",
    safe: "#5E8A5A",
    track: "#EAE6F2",
  },
  "peony-dark": {
    id: "peony-dark",
    label: "ピオニー ダーク",
    mode: "dark",
    text: "#ECE7E4",
    subText: "#A89F9B",
    background: "#1A1716",
    card: "#242020",
    border: "#3A3331",
    tint: "#D98E9C",
    icon: "#A89F9B",
    tabIconDefault: "#A89F9B",
    tabIconSelected: "#D98E9C",
    income: "#9BB8D8",
    expense: "#E8A1AD",
    warning: "#E8B36B",
    exceeded: "#E8919F",
    safe: "#A3C2A0",
    track: "#2B2725",
  },
  "lavender-dark": {
    id: "lavender-dark",
    label: "ラベンダー ダーク",
    mode: "dark",
    text: "#E9E6F0",
    subText: "#A29DAD",
    background: "#171520",
    card: "#211E2C",
    border: "#383344",
    tint: "#B3A3DC",
    icon: "#A29DAD",
    tabIconDefault: "#A29DAD",
    tabIconSelected: "#B3A3DC",
    income: "#9FAEDC",
    expense: "#DCA3BC",
    warning: "#E8B36B",
    exceeded: "#DC92AC",
    safe: "#A3C2A0",
    track: "#2A2638",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

export function defaultThemeId(
  systemScheme: "light" | "dark" | null | undefined,
): ThemeId {
  return systemScheme === "dark" ? "peony-dark" : "peony-light";
}
