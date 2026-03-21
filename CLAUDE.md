# moneyplanner — Claude Code ガイドライン

## プロジェクト概要
世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。
詳細は `PLAN.md` を参照。

## 開発サーバーについて【重要】

このプロジェクトはReact Nativeアプリのため、**previewツールはWebのみ対応**でありiOSアプリには使用できない。

### ルール
- **previewサーバーを自動起動しない** — ユーザーが自分のターミナルで `npx expo start` を実行する
- コードを編集しても `preview_start` を呼ばない
- iOSでの動作確認はユーザーがExpo GoでQRコードをスキャンして行う
- Webプレビュー（localhost:8081）はexpo-sqliteのwa-sqlite.wasmエラーが出るが、iOS動作には無関係なので無視でよい

### ユーザーが動作確認する手順
```
cd C:\Users\rnmgy\dev\moneyplanner
npx expo start
```
→ iPhoneのカメラでQRコードをスキャン → Expo Goで開く

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
