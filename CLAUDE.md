# moneyplanner — Claude Code ガイドライン

## プロジェクト概要

世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。
詳細は `PLAN.md` を参照。

## 開発サーバーについて【重要】

このプロジェクトはReact Nativeアプリのため、**previewツールはWebのみ対応**でありiOSアプリには使用できない。

### ルール

- **previewサーバーを自動起動しない** — ユーザーが自分のターミナルで `npx expo start` を実行する
- コードを編集しても `preview_start` を呼ばない
- iOSでの動作確認はTestFlightまたはexpo-dev-clientビルドで行う
- React Native Firebaseのネイティブモジュールを使うため、WebプレビューではFirebase/Authの実動作確認をしない

### ユーザーが動作確認する手順

```powershell
cd C:\Users\rnmgy\dev\moneyplanner
npx expo start
```

→ iPhoneのdev-clientビルドで開く。TestFlight検証中のビルド情報は `PLAN.md` を参照

## AIガイドラインの管理

- **両AIに共通する内容**（技術スタック・DB規則・Git規則・ファイル構成など）を変更するときは `.github/copilot-instructions.md` も同時に更新する
- **Claude Code固有の内容**（開発サーバールール・previewツール制約など）はこのファイルのみ更新する

## AI運用チェックリスト（共通）

- 詳細ルールは `docs/ai-development.md` を参照し、実行時にも遵守する
- 大きい実装や委任前に、目的・変更範囲・禁止範囲・DoD・必須テストを明記する
- セキュリティ/プライバシー影響（Rules、Auth、課金、データ削除、暗号化など）がある変更は人間レビュー必須
- AI/外部ツールへ本番データ、秘密情報、認証情報、個人情報を渡さない
- 実装で判明した仕様差分は `PLAN.md`、`ARCHITECTURE.md`、`docs/ai-development.md` に反映する
- 重要な設計判断、方針転換、採用/不採用理由は `docs/decisions/` に記録し、将来の復活判断に必要な背景と復元方針も残す

## Gitについて

- **`git push` はユーザーが明示的に指示したときのみ行う**
- コード編集・コミットは自由に行ってよいが、プッシュは指示待ち

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- Cloud Firestore（世帯単位のリアルタイム同期）
- Apple Sign-In + Firebase Auth
- React Native Firebase + expo-dev-client
- expo-file-system/legacy + expo-sharing（CSV出力）
- @react-native-community/datetimepicker

## DBについて

- Cloud Firestore に完全置換済み（`lib/firestore.ts`）
- Apple Sign-In + Firebase Auth で認証
- 世帯（household）単位でデータ分離
- リアルタイムリスナー（`onSnapshot`）で家族間同期
- 同一レコードの同時更新は `serverTimestamp()` による last-write-wins
- `lib/database.ts` / `expo-sqlite` は撤去済み。新規実装でSQLite APIを追加しないこと

## ファイル構成

```text
lib/
  firestore.ts     # Firestore CRUD
  auth.ts          # 認証ロジック
  household.ts     # 世帯管理
  csvExport.ts     # CSV生成・共有（expo-file-system/legacyを使用）
app/
  auth.tsx         # ログイン画面
  household.tsx    # 世帯作成/参加画面
app/(tabs)/
  index.tsx        # 記録タブ（初期画面）
  history.tsx      # 履歴タブ
  summary.tsx      # 集計タブ
  settings.tsx     # 設定タブ
```
