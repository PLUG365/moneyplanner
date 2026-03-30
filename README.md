# moneyplanner

世帯向けiPhone家計簿アプリ。シンプルさと使いやすさを重視。

## 機能

- **収支記録** — 日付・カテゴリ・金額・メモを手入力
- **履歴** — リスト表示 / カレンダービュー、長押し複数選択と一括コピー（日付指定）
- **集計** — 月次・年次・カテゴリ別
- **予算アラート** — カテゴリ別の共通予算、進捗表示、注意/超過トースト通知（手動クローズ可）
- **CSV出力** — BOM付きUTF-8（Excel対応）
- **カテゴリ管理** — デフォルトカテゴリ + カスタム追加、内訳管理
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

iPhoneのカメラでQRコードをスキャン → Expo Goで開く

### GitHub Codespaces（ブラウザ上で開発）

PCがなくてもブラウザだけで開発できる環境です。Node.jsなどの環境構築は不要で、起動するだけで使えます。

### 起動手順

1. [Code] ボタン → [Codespaces] タブ → [Create codespace on master]
2. ブラウザ上でVS Codeが開き、`npm install` が自動実行される

### 動作確認

```bash
npx expo start --tunnel
```

表示されたQRコードをiPhoneのカメラでスキャン → Expo Goで開く

> `--tunnel` をつけることでCodespacesの外（iPhone）からアクセスできるようになります。

## ドキュメント

| ファイル                           | 内容                             |
| ---------------------------------- | -------------------------------- |
| [PLAN.md](PLAN.md)                 | 開発ロードマップ（Phase 1〜4）   |
| [ARCHITECTURE.md](ARCHITECTURE.md) | アーキテクチャ・DB設計・フロー図 |
| [CLAUDE.md](CLAUDE.md)             | Claude Code向け開発ガイドライン  |

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- expo-sqlite v16（ローカルSQLite）
- expo-file-system/legacy + expo-sharing（CSV出力）
- TypeScript

## 開発フェーズ

- ✅ Phase 1 — コア機能（完了）
- 🔲 Phase 2 — 予算/アラート（実装済）・ライフプラン
- 🔲 Phase 3 — iCloud Drive経由の家族共有
- 🔲 Phase 4 — App Store配布
