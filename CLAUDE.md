# moneyplanner — Claude Code 指示

世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。詳細仕様は [PLAN.md](PLAN.md)、構成/データ方針は [ARCHITECTURE.md](ARCHITECTURE.md)、AI運用ルールは [docs/ai-development.md](docs/ai-development.md) を参照する。

## 最優先ルール

- React Nativeアプリのため、previewサーバーを自動起動しない。ユーザーが自分のターミナルで `npx expo start` を実行する。
- コードを編集しても `preview_start` を呼ばない。実動作確認はTestFlightまたはexpo-dev-clientビルドで行う。
- React Native Firebaseのネイティブモジュールを使うため、Web/Expo GoでFirebase/Auth/App Checkの実動作確認をしない。
- Cloud Firestoreを正とする。`lib/database.ts`、`expo-sqlite`、SQLite APIを新規追加しない。
- 世帯（household）単位のデータ分離、Apple Sign-In + Firebase Auth、Firestore Security Rulesを壊さない。
- `git push` はユーザーが明示的に指示したときだけ行う。
- 本番データ、秘密情報、認証情報、個人情報をAI/外部ツールへ渡さない。
- Security Rules、Auth/App Check、世帯参加/解除、データ削除、課金、暗号化、プライバシーに触る変更は人間レビュー必須として扱う。

## 実装方針

- 既存のFirestore CRUDは [lib/firestore.ts](lib/firestore.ts) を中心に扱い、画面側でDB実装を重複させない。
- 取引・口座・カテゴリ・内訳・店舗のスナップショット/フォールバック方針を崩さない。CSV入出力や履歴表示は既存のスナップショット方針に合わせる。
- 口座残高は「手動設定 + 記録/編集/削除時の増分」で維持する。全取引からの自動reconcileを安易に復活させない。
- 大量履歴を扱う画面では、全件リアルタイム購読や非仮想化の全件描画を避ける。
- オフライン時の固着を避ける。書き込み待ちは既存の `waitForPendingWrite` 方針に合わせる。
- 変更は最小範囲に留め、無関係なリファクタや見た目変更を混ぜない。

## 検証とドキュメント

- 変更内容に応じて、関連ユニットテスト、`npm test -- <対象test>`、`npm run lint`、Firestore Rules変更時は `npm run test:rules` を実行する。
- 実機確認が必要な変更は、最終回答でTestFlight/dev-client確認項目を明記する。
- 仕様差分が出たら [PLAN.md](PLAN.md)、[ARCHITECTURE.md](ARCHITECTURE.md)、[docs/ai-development.md](docs/ai-development.md)、必要に応じて [docs/decisions/](docs/decisions/) を更新する。
- 重要な設計判断、方針転換、採用/不採用理由はADRとして [docs/decisions/](docs/decisions/) に残す。

## AI指示ファイルの同期

- 両AIに共通する内容（技術スタック、DB規則、Git規則、ファイル構成、検証方針など）を変更するときは [.github/copilot-instructions.md](.github/copilot-instructions.md) も同時に更新する。
- Claude Code固有の内容（preview禁止、Claude向け運用制約など）はこのファイルだけに置く。

## ユーザーが実機確認する手順

```powershell
cd C:\Users\rnmgy\dev\moneyplanner
npx expo start
```

iPhoneのdev-clientビルドで開く。TestFlight検証中のビルド情報は [PLAN.md](PLAN.md) を参照する。

## 主要ファイル

```text
lib/
  firestore.ts     # Firestore CRUD
  auth.ts          # 認証ロジック
  household.ts     # 世帯管理
  csvExport.ts     # CSV生成・共有（expo-file-system/legacy）
  csvImport.ts     # CSV取り込み（検証: csvImportParse.ts / マスタ解決: csvImportResolve.ts）
app/
  auth.tsx         # ログイン画面
  household.tsx    # 世帯作成/参加画面
app/(tabs)/
  index.tsx        # 記録タブ
  history.tsx      # 履歴タブ
  summary.tsx      # 集計タブ
  settings.tsx     # 設定タブ
```
