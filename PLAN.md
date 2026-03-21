# moneyplanner 開発計画

## アプリ概要
世帯単位で使うiPhone家計簿アプリ。シンプル・使いやすさ重視。将来的にApp Store配布予定。

## 確定仕様

### 機能
| 機能 | 詳細 |
|---|---|
| 収支管理 | 手動入力（メイン）、レシート撮影OCR（Phase 2） |
| 履歴 | 一覧リスト / カレンダービュー（日付タップで詳細） |
| 集計 | 月次・年次・カテゴリ別の集計表 |
| CSV出力 | BOM付きUTF-8（Excel対応）、任意タイミングで書き出し |
| ライフプラン | 将来の家計シミュレーション（Phase 2） |
| 家族共有 | 世帯単位、iCloud経由（Phase 3） |

### 画面構成（タブ5つ）
| タブ | 内容 |
|---|---|
| 記録（初期画面） | 収支入力フォーム / レシート撮影 |
| 履歴 | リスト表示 / カレンダービュー |
| 集計 | 月次・年次・カテゴリ別 |
| 計画 | ライフプラン（Phase 2） |
| 設定 | カテゴリ管理・CSV出力 |

### DB・技術
- ローカルSQLite（expo-sqlite）
- iCloud Drive経由で世帯共有（Phase 3）
- Expo SDK 54 / React Native 0.81.5

---

## 開発フェーズ

### ✅ Phase 1 — コア機能（完了）
- [x] タブ構成（5タブ）
- [x] SQLiteデータベース設計・初期化
- [x] 記録タブ（収支入力・日付・カテゴリ・メモ）
- [x] 履歴タブ（リスト + カレンダービュー）
- [x] 集計タブ（月次・年次・カテゴリ別）
- [x] 設定タブ（カテゴリ管理・CSV出力）
- [x] 計画タブ（プレースホルダー）
- [x] iPhoneでの動作確認

### 🔲 Phase 2 — 高度機能
- [ ] レシート撮影OCR（Claude API / Vision framework）
- [ ] 履歴の編集機能（タップで編集画面）
- [ ] ライフプラン機能（年次収支予測・公的統計データ）
- [ ] 予算設定とアラート

### 🔲 Phase 3 — 家族共有
- [ ] iCloud Drive経由でのデータ同期
- [ ] 世帯単位の共有設計

### 🔲 Phase 4 — App Store配布
- [ ] Apple Developer Program 登録
- [ ] アプリアイコン・スプラッシュスクリーン
- [ ] EAS Buildでビルド
- [ ] TestFlight → App Store申請

---

## 積み残し・検討事項
- 履歴タブ：長押しで削除 → タップで編集画面にしたい
- 記録後のフィードバック：Alertより良いUI（トースト通知など）
- ダークモード対応は済み

---

## 技術スタック
| 用途 | パッケージ |
|---|---|
| フレームワーク | Expo SDK 54 / React Native 0.81.5 |
| ルーティング | expo-router v6 |
| ローカルDB | expo-sqlite v16 |
| CSV出力 | expo-file-system/legacy + expo-sharing |
| 日付入力 | @react-native-community/datetimepicker |
| OCR（予定） | Claude API (claude-opus-4-6) |
