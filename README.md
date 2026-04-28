# moneyplanner

世帯向けiPhone家計簿アプリ。シンプルさと使いやすさを重視。

## 機能

- **収支記録** — 日付・カテゴリ・金額・メモを手入力
- **履歴** — リスト表示 / カレンダービュー、長押し複数選択と一括コピー（日付指定）
- **集計** — 月次・年次・カテゴリ別
- **予算アラート** — カテゴリ別の共通予算、進捗表示、注意/超過トースト通知（手動クローズ可）
- **口座管理** — 現金/口座ごとの残高管理、取引ごとの出し入れ先の保持
- **世帯共有** — Apple Sign-In + Firebase Auth、招待コード参加、Firestoreリアルタイム同期
- **CSV出力** — BOM付きUTF-8（Excel対応）
- **カテゴリ管理** — デフォルトカテゴリ + カスタム追加、内訳管理
- **世帯管理** — メンバー解除、招待コード再発行、認証解除と全データ削除
- **計画** — 将来の家計シミュレーション（詳細は下記「計画タブ（現状）」）

## 計画タブ（現状）

- **シミュレーション** — 年次テーブルと固定サマリーで資産推移を表示
- **想定値編集** — 収入成長率・生活費上昇率・資産運用利回りを編集可能
- **家族構成（子ども）** — 生年月日・進学プランを登録
- **教育費自動提案** — 子どもの設定から教育費候補を自動生成し、ポップアップで確認して登録
- **大型出費イベント** — 教育・車・住宅の一時支出を登録
- **連動更新** — 子ども名変更時は紐づく教育イベント名を同期、子ども削除時は紐づく教育イベントも削除（確認ダイアログあり）
- **反映ルール** — 教育費の自動提案は、登録するまで結果サマリーに反映しない

## 開発環境のセットアップ

### ローカル（PC）

JavaScriptの開発サーバーはローカルPCで起動できます。ただし、React Native Firebase はネイティブモジュールを使うため、実機で動かすアプリ本体は TestFlight または expo-dev-client ビルドが必要です。Expo Go では認証・Firestore・App Checkの実動作確認はできません。

```bash
git clone https://github.com/PLUG365/moneyplanner.git
cd moneyplanner
npm install
npx expo start
```

`npx expo start` は dev-client にJavaScriptを配信するためのコマンドです。TestFlightのproductionビルドは、この開発サーバーではなくビルド済みアプリ単体で確認します。

Firebase iOS設定ファイル `GoogleService-Info.plist` はGit管理外です。ローカルでネイティブビルドを作る場合はリポジトリ直下に配置し、EAS production buildでは file secret `GOOGLE_SERVICE_INFO_PLIST` から注入します。

TestFlight検証中のビルドは `PLAN.md` の Phase 3-A / Ticket 4 を参照してください。

### GitHub Codespaces（ブラウザ上で開発）

PCがなくてもブラウザだけで開発できる環境です。Node.jsなどの環境構築は不要で、起動するだけで使えます。

ただし、React Native Firebase の実動作確認はネイティブビルドが必要なため、Codespaces上のWebプレビューでは認証・Firestore・App Checkの検証は行いません。

### 起動手順

1. [Code] ボタン → [Codespaces] タブ → [Create codespace on master]
2. ブラウザ上でVS Codeが開き、`npm install` が自動実行される

### 動作確認

```bash
npx expo start --tunnel
```

表示されたQRコードをdev-clientビルド済みのiPhoneで開く

> `--tunnel` はdev-clientへJavaScriptを配信するための確認用です。Codespaces上のWebプレビューやExpo Goでは、Firebase/Auth/App Checkの本番相当確認は行いません。

## ドキュメント構成

プロジェクト文書の入口はこのセクションに集約します。文書を追加・分割・統合・名称変更した場合は、この表もあわせて更新してください。

| 文書                                                                 | 役割                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [PLAN.md](PLAN.md)                                                   | 現在の進捗、未完了タスク、次に実施する作業の管理                                  |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                   | アプリ構成、Firestoreデータモデル、認証/認可、同期方針、主要な技術判断            |
| [README.md](README.md)                                               | プロジェクト概要、セットアップ、基本的な利用/開発手順、ドキュメント構成の目次     |
| [CLAUDE.md](CLAUDE.md)                                               | Claude Code向けの作業ルール、開発サーバー制約、リポジトリ固有の注意点             |
| [.github/copilot-instructions.md](.github/copilot-instructions.md)   | GitHub Copilot向けの作業ルール、Copilot CLI / VS Codeエージェントモードの使い分け |
| [docs/decisions/](docs/decisions/)                                   | 重要な設計判断・方針転換・採用/不採用理由の記録                                   |
| [docs/release-checklist.md](docs/release-checklist.md)               | TestFlight、App Check enforcement、App Store申請、有料化開始前の確認項目          |
| [docs/privacy-and-monetization.md](docs/privacy-and-monetization.md) | 課金、プライバシー、問い合わせ、本番データ閲覧制限の方針                          |
| [docs/ai-development.md](docs/ai-development.md)                     | AI活用、外部ツール、レビュー、知見退避ルール                                      |

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- Cloud Firestore（世帯単位のリアルタイム同期）
- Apple Sign-In + Firebase Auth
- React Native Firebase（App / Auth / Firestore / App Check）+ expo-dev-client
- expo-file-system/legacy + expo-sharing（CSV出力）
- TypeScript

## 開発フェーズ

- ✅ Phase 1 — コア機能（完了）
- ✅ Phase 2 — 予算/アラート・ライフプラン（完了、公的データ同梱更新は継続タスク）
- 🚧 Phase 3 — Cloud Firestore + Apple Sign-Inによる家族共有（実装済み、TestFlight検証中）
- 🔲 Phase 4 — App Store配布
