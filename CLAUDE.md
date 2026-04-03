# moneyplanner — Claude Code ガイドライン

## プロジェクト概要

世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。
詳細は `PLAN.md` を参照。

## 開発サーバーについて【重要】

このプロジェクトはReact Nativeアプリのため、**previewツールはWebのみ対応**でありiOSアプリには使用できない。

### ルール

- **previewサーバーを自動起動しない** — ユーザーが自分のターミナルで `npx expo start` を実行する
- コードを編集しても `preview_start` を呼ばない
- iOSでの動作確認はユーザーExpo GoでQRコードをスキャンして行う（Phase 3以降はexpo-dev-clientビルド）
- Webプレビュー（localhost:8081）はexpo-sqliteのwa-sqlite.wasmエラーが出るが、iOS動作には無関係なので無視でよい

### ユーザーが動作確認する手順

```
cd C:\Users\rnmgy\dev\moneyplanner
npx expo start
```

→ iPhoneのカメラでQRコードをスキャン → Expo Goで開く

## AIガイドラインの管理

- **両AIに共通する内容**（技術スタック・DB規則・Git規則・ファイル構成など）を変更するときは `.github/copilot-instructions.md` も同時に更新する
- **Claude Code固有の内容**（開発サーバールール・previewツール制約など）はこのファイルのみ更新する

## Gitについて

- **`git push` はユーザーが明示的に指示したときのみ行う**
- コード編集・コミットは自由に行ってよいが、プッシュは指示待ち

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- expo-sqlite v16（同期API: `openDatabaseSync`）→ Phase 3 で Cloud Firestore に完全置換予定
- expo-file-system/legacy + expo-sharing（CSV出力）
- @react-native-community/datetimepicker
- Phase 3で追加予定: @react-native-firebase/\*, expo-dev-client, expo-apple-authentication

## DBについて

### 現行（Phase 2まで）

- `lib/database.ts` のモジュールロード時に `initDatabase()` が自動実行される
- `app/_layout.tsx` では `import '@/lib/database'` で副作用importのみ行う
- useEffect内でinitDatabase()を呼ばないこと（タイミング競合の原因になる）

### Phase 3 移行後

- Cloud Firestore に完全置換（`lib/firestore.ts`）
- Apple Sign-In + Firebase Auth で認証
- 世帯（household）単位でデータ分離
- リアルタイムリスナー（`onSnapshot`）で家族間同期
- 同一レコードの同時更新は `serverTimestamp()` による last-write-wins

## ファイル構成

```
lib/
  database.ts      # SQLite操作・初期化（Phase 3でfirestore.tsに置換予定）
  firestore.ts     # Firestore CRUD（Phase 3で新規作成予定）
  auth.ts          # 認証ロジック（Phase 3で新規作成予定）
  household.ts     # 世帯管理（Phase 3で新規作成予定）
  csvExport.ts     # CSV生成・共有（expo-file-system/legacyを使用）
app/
  auth.tsx         # ログイン画面（Phase 3で新規作成予定）
  household.tsx    # 世帯作成/参加画面（Phase 3で新規作成予定）
app/(tabs)/
  index.tsx        # 記録タブ（初期画面）
  history.tsx      # 履歴タブ
  summary.tsx      # 集計タブ
  plan.tsx         # 計画タブ
  settings.tsx     # 設定タブ
```
