# moneyplanner — GitHub Copilot ガイドライン

## プロジェクト概要
世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。
詳細は `PLAN.md` を参照。

## 技術スタック
- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- expo-sqlite v16（同期API: `openDatabaseSync`）
- expo-file-system/legacy + expo-sharing（CSV出力）
- @react-native-community/datetimepicker

## DBについて
- `lib/database.ts` のモジュールロード時に `initDatabase()` が自動実行される
- `app/_layout.tsx` では `import '@/lib/database'` で副作用importのみ行う
- useEffect内でinitDatabase()を呼ばないこと（タイミング競合の原因になる）

## 開発サーバーについて
- React NativeアプリのためWeb向けpreviewは使用しない
- 動作確認はiPhoneのExpo GoでQRコードをスキャンして行う

## AIガイドラインの管理
- このファイルを更新するときは `CLAUDE.md` も同時に更新する

## Gitについて
- `git push` はユーザーが明示的に指示したときのみ行う

## ファイル構成
```
lib/
  database.ts      # SQLite操作・初期化（モジュールロード時に自動実行）
  csvExport.ts     # CSV生成・共有（expo-file-system/legacyを使用）
app/(tabs)/
  index.tsx        # 記録タブ（初期画面）
  history.tsx      # 履歴タブ
  summary.tsx      # 集計タブ
  plan.tsx         # 計画タブ
  settings.tsx     # 設定タブ
```
