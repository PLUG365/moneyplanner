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

```bash
git clone https://github.com/PLUG365/moneyplanner.git
cd moneyplanner
npm install
npx expo start
```

React Native Firebase のネイティブモジュールを使うため、iOS実機確認は Expo Go ではなく TestFlight または expo-dev-client ビルドで行います。

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

> `--tunnel` はJavaScript/画面レイアウトの軽い確認用です。Firebase/Authの本番相当確認はTestFlightまたはdev-clientで行います。

## ドキュメント

| ファイル                           | 内容                             |
| ---------------------------------- | -------------------------------- |
| [PLAN.md](PLAN.md)                 | 開発ロードマップ（Phase 1〜4）   |
| [ARCHITECTURE.md](ARCHITECTURE.md) | アーキテクチャ・DB設計・フロー図 |
| [CLAUDE.md](CLAUDE.md)             | Claude Code向け開発ガイドライン  |

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
