# moneyplanner 開発計画

## アプリ概要

世帯単位で使うiPhone家計簿アプリ。シンプル・使いやすさ重視。将来的にApp Store配布予定。

## 確定仕様

### 機能

- 収支管理: 手動入力（メイン）
- 履歴: 一覧リスト / カレンダービュー（日付タップで詳細）、長押し複数選択と一括コピー
- 集計: 月次・年次・カテゴリ別の集計表
- 口座管理: 収支の出し入れ先（口座/現金）を管理
- CSV出力: BOM付きUTF-8（Excel対応）、任意タイミングで書き出し
- ライフプラン: 将来の家計シミュレーション（Phase 2）
- 家族共有: 世帯単位、Cloud Firestore + Apple Sign-In（Phase 3）

### 画面構成（タブ5つ）

| タブ             | 内容                          |
| ---------------- | ----------------------------- |
| 記録（初期画面） | 収支入力フォーム              |
| 履歴             | リスト表示 / カレンダービュー |
| 集計             | 月次・年次・カテゴリ別        |
| 計画             | ライフプラン（Phase 2）       |
| 設定             | カテゴリ管理・CSV出力         |

### DB・技術

- Cloud Firestore（Phase 3でexpo-sqliteから完全移行）
- Apple Sign-In + 招待コードによる世帯共有（Phase 3）
- React Native Firebase（ネイティブSDK）+ expo-dev-client
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
- [x] 口座管理（収支の出し入れ先）
- [x] 設定タブ（カテゴリ管理・CSV出力）
- [x] 計画タブ（プレースホルダー）
- [x] iPhoneでの動作確認

### ✅ Phase 2 — 高度機能（完了）

- [x] 予算設定とアラート
- [x] ライフプラン機能（年次収支予測・固定パラメータ + 同梱データ）
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
- [x] 出力
  - [x] 年次テーブル
  - [x] 固定サマリー
  - [x] 推移グラフはMVP対象外（不要）
- [x] データ方針
  - [x] 初期はアプリ内固定パラメータで開始
  - [x] 同梱データにバージョン・最終更新日メタデータを持たせ、UI表示と更新要否判定を実装
  - [x] 公的データ参照は手動更新運用で対応（年1回 publicDefaults.ts の数値を更新してアプリ更新）

### 🔲 Phase 3 — 家族共有（Firebase移行）

#### 方針転換の経緯

iCloud Drive + SQLite によるファイル同期を Phase 3 として調査した結果、以下の理由で断念:


- SQLite ファイルを iCloud ubiquity container に直接配置するのは Apple ガイドライン違反
- 実用的なライブラリ `react-native-cloud-store` は pre-stable・ソロメンテナーで信頼性に難
- 妻と私で別々の場所で同時更新し、レコード単位でマージする要件を満たせない

**Cloud Firestore + Apple Sign-In** による完全置換に方針転換。

#### 旧調査メモ（iCloud方式 — 参考のみ）

- 調査1 Gist: [research-best-practices-for-icloud-drive-file-sync-in-react-native-expo-sdk-54](https://gist.github.com/minoru365/cbf8f0f758f6d5f7f4901feea1fc02f7)
- 調査2 Gist: [research-expo-file-system-icloud-drive-sync-sqlite-database-between-ios-devices](https://gist.github.com/minoru365/eb30301530a16af66eaaaaa3db7f8336)
- 調査3 Gist: [research-react-native-cloud-store-vs-expo-icloud-integration-for-shared-sqlite](https://gist.github.com/minoru365/b5cb4e81c5e4fa7d96604ee569713daa)
- 調査4 Gist: [research-multi-device-sqlite-sync-strategies-for-ios-household-apps-using-icloud](https://gist.github.com/minoru365/3772951aba2e05e98a27f737aa3474fa)

#### 採用技術

- **DB**: Cloud Firestore（オフライン永続化内蔵、リアルタイムリスナー）
- **認証**: Apple Sign-In（App Store要件にも合致）
- **SQLite**: 完全置換（Firestoreのオフラインキャッシュに委任）
- **ビルド**: expo-dev-client へ移行（React Native Firebase がネイティブモジュール必須）
- **競合解決**: 同一レコードへの同時更新は `serverTimestamp()` による last-write-wins

#### Firestore データモデル

```
/users/{userId}
  - householdId: string
  - displayName: string
  - createdAt: Timestamp

/households/{householdId}
  - createdBy: string (userId)
  - inviteCode: string (6桁、参加用)
  - createdAt: Timestamp

  /categories/{categoryId}
    - name, type, color, isDefault
    - updatedAt: Timestamp

  /breakdowns/{breakdownId}
    - categoryId, name, isDefault
    - updatedAt: Timestamp

  /transactions/{transactionId}
    - date, amount, type, accountId, categoryId, breakdownId, storeId
    - accountNameSnapshot, categoryNameSnapshot, categoryColorSnapshot
    - breakdownNameSnapshot, storeNameSnapshot
    - memo, createdAt, updatedAt: Timestamp
    - createdBy: string (userId)

  /accounts/{accountId}
    - name, balance, isDefault
    - createdAt, updatedAt: Timestamp

  /stores/{storeId}
    - name, categoryId, lastUsedAt: Timestamp

  /storeCategoryUsage/{storeId_categoryId}
    - storeId, categoryId, lastUsedAt: Timestamp

  /budgets/{year_month_categoryId}
    - year, month, categoryId, amount
    - updatedAt: Timestamp

  /planLifeEvents/{eventId}
    - eventType, paramsJson
    - createdAt, updatedAt: Timestamp

  /planProfile (単一ドキュメント: id="default")
    - payloadJson
    - updatedAt: Timestamp
```

#### 集計クエリに関する注意

現在の `getMonthCategorySummary()` / `getYearMonthlyTotals()` は SQL の `GROUP BY + SUM` で実装。Firestoreにはサーバーサイド集計がないため、**クライアントサイドで transactions を取得してJSで集計**する方式を採用（家計簿の月次データ量なら十分実用的）。

#### Phase 3-A: Firebase インフラ構築

- [ ] Ticket 1: Firebase プロジェクト作成（Firebase Console）
  - Firestore データベース作成（asia-northeast1）
  - Apple Sign-In プロバイダ有効化
  - Firestore セキュリティルール初期設定
- [ ] Ticket 2: React Native Firebase パッケージ導入
  - `@react-native-firebase/app`, `@react-native-firebase/firestore`, `@react-native-firebase/auth`
  - `expo-dev-client`, `expo-apple-authentication`, `expo-build-properties`
- [ ] Ticket 3: Expo 設定更新
  - `app.json` に Firebase config plugin 追加
  - `GoogleService-Info.plist` 配置
  - `eas.json` に development/preview/production ビルドプロファイル設定
  - Apple Developer Portal で Sign In with Apple 有効化
- [ ] Ticket 4: EAS Build での開発ビルド確認
  - `eas build --platform ios --profile development`
  - expo-dev-client での起動確認

#### Phase 3-B: 認証 & 世帯モデル

- [ ] Ticket 5: 認証画面の実装（depends on Ticket 4）
  - `app/auth.tsx` — Apple Sign-In ボタン + ログインフロー
  - `app/_layout.tsx` にAuthStateListener追加、未認証時は auth.tsx へリダイレクト
  - `lib/auth.ts` — `signInWithApple()`, `signOut()`, `getCurrentUser()`, `onAuthStateChanged()`
- [ ] Ticket 6: 世帯（Household）管理の実装（depends on Ticket 5）
  - `app/household.tsx` — 世帯作成 or 招待コード入力画面
  - `lib/household.ts` — `createHousehold()`, `joinHousehold(inviteCode)`, `getHouseholdMembers()`
  - Firestore `/users/{uid}` ドキュメント作成（householdId紐付け）
  - 招待コード: 6桁ランダム生成、`/households/{id}.inviteCode` に保存
- [ ] Ticket 7: Firestore セキュリティルール本番化（depends on Ticket 6）
  - 認証済みユーザーのみ自世帯データにアクセス可
  - `/users/{userId}` は本人のみ読み書き可
  - `firestore.rules` ファイル作成

#### Phase 3-C: データレイヤー置換

- [ ] Ticket 8: `lib/firestore.ts` 作成 — 全44関数の非同期版（depends on Ticket 6）
  - 現在の `database.ts` と同じ型定義（`Category`, `Transaction`, etc.）を維持
  - 全関数を `async` に変更
  - Firestore パス: `households/${householdId}/コレクション名`
  - `addTransaction()` → `addDoc()` + `FieldValue.increment()` で口座残高更新（バッチ書き込み）
  - `updateTransaction()` → バッチで旧残高戻し + 新残高適用
  - `deleteTransaction()` → バッチで残高戻し + ドキュメント削除
  - 全書き込みに `serverTimestamp()` で `updatedAt` 付与（last-write-wins の基盤）
  - `initDatabase()` → `initFirestore()` に置換（デフォルトカテゴリの初期投入）
- [ ] Ticket 9: リアルタイムリスナーフック作成（parallel with Ticket 8）
  - `hooks/useFirestoreCollection.ts` — 汎用 `onSnapshot` リスナーフック
  - `hooks/useFirestoreDoc.ts` — 単一ドキュメント用
  - コレクション変更時に自動的にUIが再レンダリング → 家族間リアルタイム同期

#### Phase 3-D: 全画面のUI移行

- [ ] Ticket 10: `app/_layout.tsx` 更新（depends on Ticket 5, 8）
  - `import '@/lib/database'` → 認証状態チェック + Firestore 初期化
  - 認証ガードの配置
- [ ] Ticket 11: `app/(tabs)/index.tsx`（記録タブ）更新（depends on Ticket 8, 9）
  - `getAccounts()` / `getCategories()` / `getBreakdownsByCategory()` → リスナーフック化
  - `addTransaction()` → async呼び出し + ローディング状態
  - `getBudgetStatusForDate()` → async化
- [ ] Ticket 12: `app/(tabs)/history.tsx`（履歴タブ）更新（parallel with Ticket 11）
  - `getTransactionsByMonth()` → Firestoreクエリ（where date range）+ リスナー
  - CRUD操作の async 化
- [ ] Ticket 13: `app/(tabs)/summary.tsx`（集計タブ）更新（parallel with Ticket 11）
  - 集計クエリの Firestore 化（クライアントサイド集計）
  - `getMonthCategorySummary()` → transactions コレクションからクライアント集計
- [ ] Ticket 14: `app/(tabs)/plan.tsx`（計画タブ）更新（parallel with Ticket 11）
  - ライフイベント・プロフィールの Firestore 化
- [ ] Ticket 15: `app/(tabs)/settings.tsx`（設定タブ）更新（parallel with Ticket 11）
  - マスタデータCRUDの async 化
  - ログアウト・世帯情報セクション追加
- [ ] Ticket 16: `components/TransactionEditor.tsx` 更新（parallel with Ticket 11）
  - `getStoresByCategory()` / `upsertStore()` の async 化

#### Phase 3-E: データ移行 & クリーンアップ

- [ ] Ticket 17: SQLite → Firestore 移行ツール実装（depends on Ticket 8）
  - 設定画面に「データ移行」ボタン（既存ユーザー向け、1回限り）
  - 全テーブルを順次読み出し → Firestore バッチ書き込み
  - ID マッピング（SQLite INTEGER → Firestore document ID）
- [ ] Ticket 18: CSV出力の更新（depends on Ticket 8）
  - `lib/csvExport.ts` — `getAllTransactions()` の async 化
  - Firestore から全取引取得 → CSV生成
- [ ] Ticket 19: テスト更新（depends on Ticket 8）
  - `lib/accountBalance.test.ts` — ロジックは変わらないため維持
  - `lib/csvExport.test.ts` — async 対応
  - Firestore エミュレータ or モック を使ったテスト環境構築
- [ ] Ticket 20: expo-sqlite 削除 & クリーンアップ（depends on Ticket 11-17）
  - `npm uninstall expo-sqlite`
  - `lib/database.ts` 削除
  - `lib/accountBalance.ts` 削除（ロジックは `firestore.ts` のバッチ書き込みに吸収）
  - ARCHITECTURE.md / CLAUDE.md / copilot-instructions.md 更新

#### Phase 3 対象ファイル

| 操作     | ファイル                                   | 内容                     |
| -------- | ------------------------------------------ | ------------------------ |
| 新規     | `lib/firestore.ts`                         | 全44関数のFirestore版    |
| 新規     | `lib/auth.ts`                              | 認証ロジック             |
| 新規     | `lib/household.ts`                         | 世帯管理                 |
| 新規     | `hooks/useFirestoreCollection.ts`          | リアルタイムリスナー     |
| 新規     | `hooks/useFirestoreDoc.ts`                 | 単一ドキュメントリスナー |
| 新規     | `app/auth.tsx`                             | ログイン画面             |
| 新規     | `app/household.tsx`                        | 世帯作成/参加画面        |
| 新規     | `firestore.rules`                          | セキュリティルール       |
| 新規     | `eas.json`                                 | EAS Build設定            |
| 大幅変更 | `app/_layout.tsx`                          | 認証ガード + 初期化変更  |
| 大幅変更 | 全5タブ + `TransactionEditor.tsx`          | sync → async + リスナー  |
| 大幅変更 | `lib/csvExport.ts`                         | async化                  |
| 設定変更 | `app.json`, `package.json`                 | Firebase plugin / deps   |
| 削除     | `lib/database.ts`, `lib/accountBalance.ts` | SQLite層撤去             |

#### Phase 3 検証項目

1. EAS Build で開発ビルドが iOS に正常インストールされること
2. Apple Sign-In でログインし、`/users/{uid}` ドキュメントが作成されること
3. 世帯作成 → 招待コード生成 → 別アカウントで参加できること
4. 記録タブで収支登録 → 別端末でリアルタイムに反映されること
5. 同一レコードを2端末から更新 → 最後の書き込みが両端末に反映されること（last-write-wins）
6. オフラインで記録 → オンライン復帰時に自動同期されること
7. 集計タブの数値が Firestore データと一致すること
8. CSV出力が Firestore データから正しく生成されること
9. 既存 SQLite データの Firestore 移行が欠損なく完了すること

#### Phase 3 除外スコープ

- Push通知（家族が記録したときの通知）→ Phase 4以降
- Cloud Functions（集計の事前計算など）→ 必要になるまで見送り
- 複数世帯への所属 → サポートしない（1ユーザー = 1世帯）
- Android対応 → iPhoneのみ

### 🔲 Phase 4 — App Store配布

- [ ] Apple Developer Program 登録
- [ ] アプリアイコン・スプラッシュスクリーン
- [ ] EAS Buildでビルド
- [ ] TestFlight → App Store申請

---

## 積み残し・検討事項

- 履歴タブに検索機能を追加（キーワード・カテゴリ・口座・金額範囲などでフィルタ）
- 履歴タブで年月ピッカーを使って任意の月へジャンプできる機能
- 集計タブでカテゴリ行をタップしたとき該当レコード一覧へドリルダウンできる機能

---

## 技術スタック

| 用途           | パッケージ                                   |
| -------------- | -------------------------------------------- |
| フレームワーク | Expo SDK 54 / React Native 0.81.5            |
| ルーティング   | expo-router v6                               |
| DB             | Cloud Firestore（Phase 3で移行）             |
| 認証           | Apple Sign-In（Phase 3で追加）               |
| Firebase       | @react-native-firebase/\*（Phase 3で追加）   |
| ビルド         | expo-dev-client + EAS Build（Phase 3で移行） |
| CSV出力        | expo-file-system/legacy + expo-sharing       |
| 日付入力       | @react-native-community/datetimepicker       |
| ~~旧DB~~       | ~~expo-sqlite v16~~（Phase 3で削除予定）     |
