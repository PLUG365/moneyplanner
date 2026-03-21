# moneyplanner

世帯向けiPhone家計簿アプリ。シンプルさと使いやすさを重視。

## 機能

- **収支記録** — 日付・カテゴリ・金額・メモを手入力
- **履歴** — リスト表示 / カレンダービュー
- **集計** — 月次・年次・カテゴリ別
- **CSV出力** — BOM付きUTF-8（Excel対応）
- **カテゴリ管理** — デフォルト14種 + カスタム追加

## 開発環境のセットアップ

```bash
git clone <repo>
cd moneyplanner
npm install
npx expo start
```

iPhoneのカメラでQRコードをスキャン → Expo Goで開く

## ドキュメント

| ファイル | 内容 |
|---|---|
| [PLAN.md](PLAN.md) | 開発ロードマップ（Phase 1〜4） |
| [ARCHITECTURE.md](ARCHITECTURE.md) | アーキテクチャ・DB設計・フロー図 |
| [CLAUDE.md](CLAUDE.md) | Claude Code向け開発ガイドライン |

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- expo-sqlite v16（ローカルSQLite）
- TypeScript

## 開発フェーズ

- ✅ Phase 1 — コア機能（完了）
- 🔲 Phase 2 — レシートOCR・編集機能・ライフプラン
- 🔲 Phase 3 — iCloud Drive経由の家族共有
- 🔲 Phase 4 — App Store配布
