# moneyplanner 開発計画

## アプリ概要

世帯単位で使うiPhone家計簿アプリ。シンプル・使いやすさ重視。将来的にApp Store配布予定。

## 確定仕様

### 機能

- 収支管理: 手動入力（メイン）
- 履歴: 一覧リスト / カレンダービュー（日付タップで詳細）、長押し複数選択と一括コピー
- 集計: 月次・年次・カテゴリ別の集計表
- CSV出力: BOM付きUTF-8（Excel対応）、任意タイミングで書き出し
- ライフプラン: 将来の家計シミュレーション（Phase 2）
- 家族共有: 世帯単位、iCloud経由（Phase 3）

### 画面構成（タブ5つ）

| タブ             | 内容                          |
| ---------------- | ----------------------------- |
| 記録（初期画面） | 収支入力フォーム              |
| 履歴             | リスト表示 / カレンダービュー |
| 集計             | 月次・年次・カテゴリ別        |
| 計画             | ライフプラン（Phase 2）       |
| 設定             | カテゴリ管理・CSV出力         |

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
- [x] 履歴タブの長押し選択モード（一括コピー、コピー先日付指定）
- [x] 旧レコードコピー時のスナップショット名によるカテゴリ/内訳再解決と未コピー一覧表示
- [x] 集計タブ（月次・年次・カテゴリ別）
- [x] 設定タブ（カテゴリ管理・CSV出力）
- [x] 計画タブ（プレースホルダー）
- [x] iPhoneでの動作確認

### 🔲 Phase 2 — 高度機能

- [x] 予算設定とアラート
- [ ] ライフプラン機能（年次収支予測・公的統計データ）
- [x] 記録後フィードバック改善（トースト通知など）

### Phase 2 調査実行（Copilot CLI /research）

- [x] 調査1: 家計シミュレーションMVPの設計パターン
  - /research MVP architecture for annual household financial simulation in mobile apps, focusing on explainable assumptions and incremental rollout
- [x] 調査2: 日本の公的・公開データ候補（ライセンス/更新頻度含む）
  - /research Japanese public datasets usable for household cost and wage trend assumptions, including update frequency and licensing constraints
- [x] 調査3: 大型出費イベントのモデル化（車・住宅・進学）
  - /research Modeling patterns for major household expenses such as car purchase, housing, and education in long-term financial planning apps
- [x] 調査4: アプリ内アラートUIの設計
  - /research Best practices for in-app budget alert UX with progress bars, status badges, and accessible color semantics in finance apps

#### 調査メモ（参考URL）

- 調査1 Gist: [research-mvp-architecture-for-annual-household-financial-si](https://gist.github.com/minoru365/d4ffe5031aaa849c2537acc2cd768301)
- 調査2 Gist: [research-japanese-public-datasets-usable-for-household-cost](https://gist.github.com/minoru365/8ff54c97a76bf9d58be5bc6137cf87e3)
- 調査3 Gist: [research-modeling-patterns-for-major-household-expenses-suc](https://gist.github.com/minoru365/9e9639a80985ed5cd03e4b56570d38db)
- 調査4 Gist: [research-best-practices-for-in-app-budget-alert-ux-with-pro](https://gist.github.com/minoru365/954de07643a4b727df3ddf63c7d81cad)

### Phase 2-1 実装チケット（予算機能）

#### 調査4反映: 予算アラートUI方針

- [x] 閾値は3段階（safe <80%, warning 80-99%, exceeded >=100%）
- [x] 色だけで伝えない（バッジ/アイコン/文言を併用）
- [x] 集計タブはインライン通知中心（行背景の薄いtint + 進捗バー + バッジ）
- [x] 記録直後の保存トースト + 注意/超過トースト表示（warning/exceededは都度通知、手動クローズ対応）
- [x] ダークモード向けwarning/exceeded配色はコントラスト優先で別定義

- [x] Ticket A: 予算テーブル追加（カテゴリ別・共通）
  - 目的: 予算をカテゴリ単位で保存し、全ての年・全ての月に共通適用する（内訳単位は扱わない）
- [x] Ticket B: 予算CRUDのDB関数実装
  - 目的: カテゴリ別の登録/更新/取得/削除を統一APIで提供
- [x] Ticket C: 設定タブに予算設定UIを追加
  - 目的: 設定管理ポップアップ内でカテゴリ別共通予算を編集（カテゴリ/支出時のみ表示、入力即時保存）
- [x] Ticket D: 集計タブに予算進捗表示を追加
  - 目的: 使用率（%）/ 残予算 / 超過額を表示
- [x] Ticket E: 予算アラート表示（アプリ内のみ）
  - 目的: 80%以上=注意、100%以上=超過を視覚表示（バッジ + 進捗バー + 薄い背景色）
- [x] Ticket F: 記録後トースト通知を導入
  - 目的: Alertの代替として低侵襲な保存完了フィードバックを提供し、予算注意/超過時の視覚通知を統一

### ライフプランMVP（Phase 2-2）

#### 調査1反映: 採用アーキテクチャ

- [x] シミュレーション計算を `lib/simulation/` の純関数へ分離
  - `runSimulation(input, assumptions) -> ProjectionRow[]` を中核にする
- [x] 想定値をレジストリ管理（説明・初期値・出典・範囲）
  - UIで「なぜその値か」を説明可能にする
- [x] DBは追加テーブル方式で拡張（既存テーブルは非破壊）
  - `plan_life_events`（実装済み）
  - `plan_profiles` / `plan_assumption_overrides` は今後検討
- [x] 段階導入（2-2a -> 2-2b -> 2-2c）
  - 2-2a: 固定デフォルト + 年次テーブル（最小実装）
  - 2-2b: 想定値編集 + 上書き保存（SQLite）
  - 2-2c: 公的データ由来の初期値に置換（ランタイム取得ではなく同梱データ優先）

#### 調査2反映: 公的データ採用方針

- [x] ライセンス方針
  - e-Stat公開統計は政府標準利用規約2.0準拠（CC BY 4.0相当）として二次利用可
  - アプリ内で出典表記を明示する
- [x] 取得方針
  - ランタイムAPI呼び出しは行わず、`publicDefaults.ts` へ同梱する静的データ方式を採用
  - 年1回（推奨: 10〜11月）にデータ更新スクリプトで再生成し、アプリ更新で反映
- [x] 初期採用データセット
  - 家計調査（00200561）: 支出構成比・家計支出の基準値
  - 消費者物価指数 CPI（00200573）: 生活費インフレ率
  - 民間給与実態統計調査（00351000）: 収入成長率
  - 毎月勤労統計（00450071）: 短期トレンド参照（補助）
  - 年金額（厚労省公表資料）: e-Stat非対応のため静的定数で管理
- [x] 実装補足
  - `statsDataId` は改訂で変更され得るため、更新時に `getStatsList` で再確認する
  - 想定値エディタに `sourceLabel` / `sourceUrl` を表示し説明可能性を担保する

#### 調査3反映: 大型出費イベントのモデル化方針

- [x] イベント表現
  - 大型出費は `LifeEvent` の typed event として管理し、expander層で年次キャッシュフローへ展開する
  - コアエンジンは純関数のまま維持（expanderでドメイン知識を吸収）
- [x] DB拡張
  - `plan_life_events` テーブルを追加（`event_type`, `params_json` で可変パラメータを保持）
  - `params_json` は読み出し時に `event_type` ベースで検証して型安全を確保する
- [x] 2-2bの優先実装順
  - まず `child_education` を先行実装（入力負担が低く、年齢ベースで自動展開しやすい）
  - 次に `car_purchase`（一時支出モデル）
  - その後 `housing_purchase`（一時支出モデル）
- [x] MVP簡略化方針
  - 車の売却価値追跡は2-2cまで見送り
  - 住宅ローン等の多層モデルは2-2cまで見送り
- [x] 入力UI方針
  - 計画タブ内でセクション分割・折り畳み入力を採用
  - 教育費自動提案はポップアップ確認後に登録する方式を採用

- [x] 入力項目
  - 年収、家族構成（子ども: 生年月日/進学プラン）、大型出費計画（教育/車/住宅）、資産情報
- [x] 計算モデル
  - 年次資産推移（収入 - 支出 - 大型出費 + 増減要因）
- [ ] 出力
  - [x] 年次テーブル
  - [ ] 推移グラフ
- [ ] データ方針
  - [x] 初期はアプリ内固定パラメータで開始
  - [ ] 後続で公的データ参照（同梱データ更新運用を含む）へ拡張

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

- 予算アラート集計：旧データのカテゴリ再紐付け戦略（カテゴリ名フォールバック継続か、ID移行を追加するか）
- ダークモード対応は済み

---

## 技術スタック

| 用途           | パッケージ                             |
| -------------- | -------------------------------------- |
| フレームワーク | Expo SDK 54 / React Native 0.81.5      |
| ルーティング   | expo-router v6                         |
| ローカルDB     | expo-sqlite v16                        |
| CSV出力        | expo-file-system/legacy + expo-sharing |
| 日付入力       | @react-native-community/datetimepicker |
