# moneyplanner 開発計画

## このファイルの役割

このファイルは現在の進捗管理と未完了タスクの一覧を主目的とする。確定済みの構成・データモデルは [ARCHITECTURE.md](ARCHITECTURE.md)、全体のドキュメント構成は [README.md](README.md#ドキュメント構成) を参照する。

作業完了時は、変更内容に応じて [README.md](README.md#ドキュメント構成) のドキュメント構成と、関連する設計・運用ドキュメントの更新要否を確認する。

## アプリ概要

世帯単位で使うiPhone家計簿アプリ。シンプル・使いやすさ重視。将来的にApp Store配布予定。

## 確定仕様

### 機能

- 収支管理: 手動入力（メイン）
- 履歴: 一覧リスト / カレンダービュー（日付タップで詳細）、長押し複数選択と一括コピー
- 集計: 月次・年次・カテゴリ別の集計表
- 口座管理: 収支の出し入れ先（口座/現金）を管理
- 予算アラート: カテゴリ別の共通予算、進捗表示、注意/超過トースト通知
- CSV出力: BOM付きUTF-8（Excel対応）、任意タイミングで書き出し
- CSV取り込み: エクスポート形式のCSVを設定タブから一括取り込み（詳細は「CSV入出力仕様」）
- 家族共有: 世帯単位、Cloud Firestore + Apple Sign-In（Phase 3実装および既存機能検証は完了。現行NANBOの次回TestFlight確認は未完了）
- 招待QRコード: 招待コードを設定タブ・世帯作成画面でQR表示し、参加画面でカメラ読み取りできる（2026-07-03実装。生成は純JS `lib/inviteQr.ts`、読み取りは expo-camera を遅延ロード）

### 画面構成（タブ4つ）

| タブ             | 内容                              |
| ---------------- | --------------------------------- |
| 記録（初期画面） | 収支入力フォーム                  |
| 履歴             | リスト表示 / カレンダービュー     |
| 集計             | 月次・年次・カテゴリ別 + 予算進捗 |
| 設定             | カテゴリ管理・CSV入出力・世帯管理 |

> ライフプラン（旧計画タブ）は廃止しました。詳細は [docs/decisions/plan-feature-retirement.md](docs/decisions/plan-feature-retirement.md) を参照。

### DB・技術

- Cloud Firestore（expo-sqliteから完全移行済み）
- Apple Sign-In + 招待コードによる世帯共有
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
- [x] iPhoneでの動作確認

### ✅ Phase 2 — 高度機能（完了）

- [x] 予算設定とアラート（カテゴリ別共通予算 / 3段階アラート / トースト通知）
- [x] 記録後フィードバック改善（トースト通知、保存後の予算判定）

> 予算アラートUI方針の詳細は実装コミット履歴と `app/(tabs)/summary.tsx` を参照。ライフプラン機能（旧 Phase 2-2）は廃止済み → [docs/decisions/plan-feature-retirement.md](docs/decisions/plan-feature-retirement.md)

### 🚧 Phase 3 — 家族共有（Firebase移行・既存機能検証完了、現行NANBO TestFlight確認待ち）

#### 方針転換の経緯・採用技術

iCloud Drive + SQLite を断念して Cloud Firestore + Apple Sign-In へ移行した判断理由、旧調査メモ、採用技術は [docs/decisions/firestore-migration.md](docs/decisions/firestore-migration.md) を参照する。

> SQLite置換実装、known-issues.mdの課題対応、既存の世帯共有・招待機能の検証は完了済み。build 24〜31の既存検証は完了しているが、build 31は旧ブランド `mina - みんなの家計簿` の履歴である。現行 `NANBO - みんなの家計簿` のproduction build作成およびTestFlight確認は未実施。検証履歴と次回確認項目は [docs/testflight-history.md](docs/testflight-history.md) を参照。

#### 現在のリリース状況（2026-07-12）

- [x] 既存の世帯共有・招待機能の確認を完了
- [x] build 31の旧ブランド `mina - みんなの家計簿` としての確認を完了
- [ ] 現行 `NANBO - みんなの家計簿` のproduction buildを作成
- [ ] 次回NANBO TestFlightで現行ブランド、世帯共有継続、Analytics収集無効化のリリースゲートを確認

#### Firestore データモデル

Firestoreのコレクション/フィールド定義は [ARCHITECTURE.md](ARCHITECTURE.md#firestore-コレクション詳細) を正とする。PLANでは進捗と未完了タスクのみを管理する。

#### マスタ変更とスナップショット運用方針

- 取引登録・更新時に、カテゴリ/内訳/店舗/口座の表示名やカテゴリ色を `transactions` の `*Snapshot` フィールドへ保存する
- 履歴画面とCSV出力は、登録時点の証跡性を優先して `transactions` のスナップショット値を表示・出力する
- 集計画面と予算画面は、現在の家計管理単位として見やすくするため、原則として現行カテゴリマスタの名前・色を優先して表示する
- 集計時のカテゴリ表示名・色は、`categoryId` が現行カテゴリに存在する場合は現行マスタを使い、カテゴリ削除済みまたは `categoryId` が `null` の場合は取引スナップショットへフォールバックする。スナップショットもない場合は「未分類」とする
- 内訳削除時は過去取引の `breakdownNameSnapshot` を空にせず、`breakdownId` の参照解除に留める。過去取引の内訳名は履歴・CSV上の証跡として残す
- 口座名変更時は、口座別の表示・集計で現在名に揃えるため、既存取引の `accountNameSnapshot` を更新する方針とする
- `accountId` はカテゴリ等と同様に `null`（マスタ非紐付け）を取り得る（インポートで未知の口座名だった場合）。`null` の取引は表示を `accountNameSnapshot` にフォールバックする（[docs/decisions/import-unknown-account-nullable.md](docs/decisions/import-unknown-account-nullable.md)）
- 口座残高は「**手動設定（`updateAccountBalance`）＋ 記録/編集/削除時の増分（`FieldValue.increment`）**」のみで維持する。全取引からの自動再計算（reconcile）はインポート分を残高へ折り込んでしまうため**自動実行しない**。インポート取引は残高に影響しない（[docs/decisions/account-balance-incremental-only.md](docs/decisions/account-balance-incremental-only.md)）

実装状況:

- [x] 取引登録・更新時に `accountNameSnapshot` / `categoryNameSnapshot` / `categoryColorSnapshot` / `breakdownNameSnapshot` / `storeNameSnapshot` を保存する
- [x] 履歴画面とCSV出力で取引スナップショット値を使う
- [x] 口座名変更時に既存取引の `accountNameSnapshot` を更新する
- [x] 予算画面で現行カテゴリマスタの名前・色を使う
- [x] 内訳削除時に `breakdownNameSnapshot` を空にせず、`breakdownId` の参照解除だけにする
- [x] 集計画面で現行カテゴリマスタの名前・色を優先し、削除済みカテゴリは取引スナップショットへフォールバックする
- [x] 上記のスナップショット/フォールバック挙動を純関数テストまたは既存テストへ追加する

#### CSV入出力仕様

- 列構成は8列 `日付,種別,口座,カテゴリ,内訳,店舗,金額,メモ`（2026-06に店舗列を追加。旧7列形式は取り込み時のみ受理し店舗は空扱い）
- エクスポート: BOM付きUTF-8、CRLF、RFC4180準拠の引用符エスケープ。値は取引スナップショットを出力
- CSV数式インジェクション対策（`lib/csvFormat.ts`）: エクスポート時、`=` `+` `-` `@` タブ・CR で始まるフィールドにシングルクォートを前置して無害化する。取り込み時は `stripCsvFormulaGuard` で同じ接頭辞を除去するため、エクスポート→再取り込みの往復で値は保たれる
- 金額上限: 手入力・CSV取り込みとも `MAX_TRANSACTION_AMOUNT`（1億円、`lib/transactionAmountValidation.ts`）を共通上限とし、超過行は取り込みエラーにする
- 取り込み（`lib/csvImport.ts` / `csvImportParse.ts` / `csvImportResolve.ts`）:
  - 全行を事前検証し、エラーが1件でもあれば行番号付きで表示して全件中断（部分取り込みなし）
  - 検証: 日付は実在日のYYYY-MM-DD、種別は収入/支出、金額は0以上の整数（0円はメモ必須＝記録画面の登録ルールと同一。エクスポート→再取り込みの往復を保証するため）。口座/カテゴリ/内訳/店舗/メモは空欄許容
  - カテゴリ/内訳はtrim後の名前完全一致でマスタ紐付け（カテゴリは種別も一致条件、内訳はカテゴリ配下のみ）。不一致は `id=null`＋名前スナップショットのみで、マスタは自動作成しない
  - 店舗はマスタ紐付けを行わず、取り込み時も `storeId=null` と店名スナップショットのみを保存する。店舗候補は取引の `storeNameSnapshot` をローカル取引キャッシュから集約して表示する（[docs/decisions/store-candidates-from-transactions.md](docs/decisions/store-candidates-from-transactions.md)）
  - 口座は名前一致でマスタ紐付け。口座名が空の行はデフォルト口座（`DEFAULT_ACCOUNT_ID`）に紐付ける。口座名ありで不一致の場合はカテゴリ等と同様に `accountId=null`＋名前スナップショットのみとし、デフォルト口座へ偽紐付けしない（詳細は [docs/decisions/import-unknown-account-nullable.md](docs/decisions/import-unknown-account-nullable.md)）
  - 取り込みでは口座残高・店舗の使用履歴（`lastUsedAt` / `storeCategoryUsage`）を更新しない。**インポート取引は口座残高に影響しない**（自動 reconcile を廃止したため折り込まれない。[docs/decisions/account-balance-incremental-only.md](docs/decisions/account-balance-incremental-only.md)）
  - 重複検出なし（同一行の再取り込みは重複登録される）。文字コードはUTF-8（BOM有無）/ UTF-16LE（BOM付き）/ Shift_JIS（ExcelのCSV保存互換）に対応
  - Firestoreへは450件単位のバッチ書き込み（`importTransactions`）。バッチごとの進捗を共通の進捗オーバーレイ（`components/ProgressOverlay.tsx`）で表示
  - バッチ間のロールバックはないため、途中失敗時は部分取り込みのまま停止する（再実行すると取り込み済み分が重複する点に注意）

#### 集計クエリに関する注意

FirestoreにはSQLiteの `GROUP BY + SUM` 相当のサーバーサイド集計を直接置き換える仕組みがないため、`transactions` を取得してJSで集計する方式を採用（家計簿の月次データ量なら十分実用的）。集計ロジックは `lib/summaryAggregation.ts` に分離し、集計タブとFirestore API側で再利用する。

#### Firebase置換の完了条件

Phase 3では、SQLiteで実装済みの全機能をFirestore/Firebase Authへ置換する。記録・履歴・集計・設定・カテゴリ/内訳・店舗・口座・予算・CSV出力の全導線はFirestoreデータのみで動作する実装へ移行済み。既存SQLiteデータの移行は行わず、移行後は新規Firestoreデータとして開始する。

#### 画面移行の共通方針

- SQLite版の `number` ID は Firestore版ではすべて `string` ID に統一する。`DEFAULT_ACCOUNT_ID` は `1` ではなく `default` を使う
- 各画面・コンポーネントの state / props / 選択ID / Mapキー / テスト用モックも `number` から `string` へ更新する
- 既存の同期DB呼び出しは `async/await` に置き換え、保存・更新・削除中は二重送信防止のローディング状態を持たせる
- マスタデータ・表示中の月の取引一覧・世帯情報はリアルタイムリスナーを優先し、集計値は表示対象期間の `transactions` を取得してクライアント側で再計算する
- リスナーの `permission-denied` や世帯未所属検出時は `clearHouseholdCache()` と画面状態リセットを行い、世帯作成/参加画面へ戻す

#### データプライバシー方針

プライバシー方針、収益化時のデータ扱い、クレーム予防は [docs/privacy-and-monetization.md](docs/privacy-and-monetization.md) を正とする。PLANでは未完了タスクのみを管理する。

#### 要件見直し候補

- [x] 全データ削除・メンバー解除の権限は世帯参加者全員が等しく持つ方針とし、オーナー/管理者ロールは導入しない
- [x] 最後の1人が世帯から退出/解除する場合に、世帯データを削除する方針で明確化する（最後のメンバー退出時は世帯全削除）
- [x] 招待コードを恒久コードのままにするか、有効期限付きコードへ変更するか判断する（有効期限付きコードを採用）
- [x] 6文字招待コードは維持しつつ、参加承認制・有効期限・試行制限で総当たりリスクを抑える設計にする（2026-07-02改訂: 新規発行はCSPRNG 10文字へ強化。[docs/decisions/invite-join-bruteforce-mitigation.md](docs/decisions/invite-join-bruteforce-mitigation.md)）
- [x] 世帯参加時はニックネーム入力を必須にし、承認画面・メンバー一覧で識別できるようにする（履歴上の作成者表示は対象外）
- [x] 有料販売/サブスク化に伴い、開発者によるユーザー家計データの閲覧・再利用を制限する技術/運用ルールを決める（`docs/operations-data-access-policy.md`）

#### Phase 3-A: Firebase インフラ構築

- [x] Ticket 1: Firebase プロジェクト作成（Firebase Console）
  - Firestore データベース作成（asia-northeast1）
  - Apple Sign-In プロバイダ有効化
  - Firestore セキュリティルール初期設定
- [x] Ticket 2: React Native Firebase パッケージ導入
  - `@react-native-firebase/app`, `@react-native-firebase/firestore`, `@react-native-firebase/auth`
  - `expo-dev-client`, `expo-apple-authentication`, `expo-build-properties`
- [x] Ticket 3: Expo 設定更新
  - `app.json` に Firebase config plugin 追加
  - `GoogleService-Info.plist` 配置
  - `eas.json` に development/preview/production ビルドプロファイル設定
  - Apple Developer Portal で Sign In with Apple 有効化
- [x] Ticket 4: EAS Build / TestFlight 用 iOS ビルド確認
  - build 10〜24 までの作成・実機検証・発見事項・修正経緯は [docs/testflight-history.md](docs/testflight-history.md) を正とする
  - 2026-05-01、Firestoreテストモード期限切れ通知を受け、`npm run test:rules` 成功後に `npx firebase deploy --only firestore:rules --project moneyplanner-a070b` でSecurity Rulesを本番Firebaseプロジェクトへ反映済み

#### Phase 3-A ビルド設定メモ

- `GoogleService-Info.plist` はGitに含めず、EAS production環境の file secret `GOOGLE_SERVICE_INFO_PLIST` として渡す
- Firebase CLIの既定プロジェクトIDは `.firebaserc` の `moneyplanner-a070b` とする（Firebase Console上の表示名は `moneyplanner`）
- `app.config.js` でローカル時は `./GoogleService-Info.plist`、EAS Build時は `process.env.GOOGLE_SERVICE_INFO_PLIST` を参照
- React Native Firebase + `useFrameworks: "static"` 対応として `plugins/withRNFirebaseStaticFramework.js` で `$RNFirebaseAsStaticFramework = true` をPodfileへ注入
- Xcode 26 / React Native 0.81 prebuilt Core / RNFBFirestore の module import エラー回避として `expo-build-properties.ios.buildReactNativeFromSource = true` を設定
- Expo SDK 54 の依存チェックに合わせて `eslint-config-expo ~10.0.0` / `typescript ~5.9.2` に更新

#### Phase 3-B: 認証 & 世帯モデル

- [x] Ticket 5: 認証画面の実装（depends on Ticket 4）
  - `app/auth.tsx` — Apple Sign-In ボタン + ログインフロー
  - `app/_layout.tsx` にAuthStateListener追加、未認証時は auth.tsx へリダイレクト
  - `lib/auth.ts` — `signInWithApple()`, `signOut()`, `getCurrentUser()`, `onAuthStateChanged()`
- [x] Ticket 6: 世帯（Household）管理の実装（depends on Ticket 5）
  - `app/household.tsx` — 世帯作成 or 招待コード入力画面
  - `lib/household.ts` — `createHousehold()`, `joinHousehold(inviteCode)`, `getHouseholdMembers()`
  - Firestore `/users/{uid}` ドキュメント作成（householdId紐付け）
  - 招待コード: 6文字ランダム生成、`/households/{id}.inviteCode` に保存（2026-07-02: expo-cryptoによるCSPRNG 10文字生成へ変更。旧6文字コードは期限内有効）
  - Phase 3-D/Eで `/households/{id}/members/{uid}` 作成・参照方式へ補強する（現行の `/users` 横断検索は本番ルールでは使わない）
- [x] Ticket 7: Firestore セキュリティルール本番化（depends on Ticket 6）
  - 認証済みユーザーのみ自世帯データにアクセス可
  - `/users/{userId}` は本人のみ読み書き可
  - `firestore.rules` ファイル更新（`userHouseholdId()` ヘルパーで世帯メンバー制限）

#### Phase 3-C: データレイヤー置換

- [x] Ticket 8: `lib/firestore.ts` 作成 — 全関数の非同期版（depends on Ticket 6）
  - 旧 `database.ts` と同等の型・関数をFirestore版として提供（IDはstring化）
  - 全関数を `async` に変更
  - Firestore パス: `households/${householdId}/コレクション名`
  - `addTransaction()` → `addDoc()` + `FieldValue.increment()` で口座残高更新（バッチ書き込み）
  - `updateTransaction()` → バッチで旧残高戻し + 新残高適用（同一口座ならデルタ合算）
  - `deleteTransaction()` → バッチで残高戻し + ドキュメント削除
  - 全書き込みに `serverTimestamp()` で `updatedAt` 付与（last-write-wins の基盤）
  - `initFirestore()` — デフォルトカテゴリ・内訳・口座の冪等初期投入
  - `clearHouseholdCache()` — サインアウト時のキャッシュクリア用
  - `commitBatchOps()` — 499件制限対応のバッチ分割ヘルパー
- [x] Ticket 9: リアルタイムリスナーフック作成（parallel with Ticket 8）
  - `hooks/useFirestore.ts` — `useCollection<T>` / `useDocument<T>` / `useHouseholdId`
  - queryKey パターンで onSnapshot リスナーの再購読を制御
  - ref パターンで mapFn/queryFactory の再レンダリング問題を回避
  - コレクション変更時に自動的にUIが再レンダリング → 家族間リアルタイム同期

#### Phase 3-D: 全画面のUI移行

- [x] Ticket 10: `app/_layout.tsx` 更新（depends on Ticket 5, 8）
  - `import '@/lib/database'` → 認証状態チェック + Firestore 初期化
  - 認証ガードの配置
- [x] Ticket 11: `app/(tabs)/index.tsx`（記録タブ）更新（depends on Ticket 8, 9）
  - [x] `getAccounts()` / `getCategories()` / `getBreakdownsByCategory()` → リスナーフック化
  - [x] `addTransaction()` → async呼び出し + ローディング状態
  - [x] `getBudgetStatusForDate()` → async化
- [x] Ticket 12: `app/(tabs)/history.tsx`（履歴タブ）更新（parallel with Ticket 11）
  - [x] `getTransactionsByMonth()` / `getTransactionsByDate()` / `getDatesWithTransactions()` → Firestore asyncクエリ化
  - [x] CRUD操作の async 化
  - [x] 長押し一括コピーのカテゴリ/内訳/口座再解決をstring ID対応の純関数へ分離
  - [x] リアルタイムリスナー化
- [x] Ticket 13: `app/(tabs)/summary.tsx`（集計タブ）更新（parallel with Ticket 11）
  - [x] 集計クエリの Firestore 化（クライアントサイド集計）
  - [x] `getMonthCategorySummary()` / `getMonthBudgetStatuses()` / `getYearMonthlyTotals()` をasync呼び出しへ置換
  - [x] 画面読み込みのasync化と読み込み中表示を追加
  - [x] リアルタイムリスナー化
- [x] Ticket 15: `app/(tabs)/settings.tsx`（設定タブ）更新（parallel with Ticket 11）
  - [x] マスタデータCRUDの async 化
  - [x] ログアウト・世帯情報セクション追加
  - [x] 世帯メンバー一覧・招待コード表示・メンバー解除導線を追加
- [x] Ticket 16: `components/TransactionEditor.tsx` 更新（parallel with Ticket 11）
  - `getStoresByCategory()` / `upsertStore()` の async 化

#### Phase 3-E: 認証解除・プライバシー・クリーンアップ

- [x] Ticket 17: 認証解除 + 世帯全データ削除の実装（depends on Ticket 8, 15）
  - [x] 設定画面に「認証解除と全データ削除」ボタンを追加
  - [x] 世帯メンバーであれば誰でも実行可能にする
  - [x] 実行時に `households/{householdId}` 配下の既知サブコレクションと世帯ドキュメントを削除
  - [x] 現在のユーザーの `/users/{uid}` を削除し、Firebase Authアカウント削除（アプリ側の認証解除）を行う
  - [x] 他メンバーのAuthアカウントは削除せず、次回起動時に世帯未所属として扱う
  - [x] 取り消せない操作として、確認ダイアログ・入力確認・Apple再認証を挟む
  - [x] Firestore Rulesエミュレータテストを追加する
  - [x] JDK 25で `npm run test:rules` を実行し、削除フローを検証する
- [x] Ticket 18: メンバー解除の実装（depends on Ticket 6, 15）
  - [x] 設定画面の世帯メンバー一覧から対象メンバーを解除できるようにする
  - [x] 世帯メンバーであれば誰でも他メンバーを解除可能にする
  - [x] `createHousehold()` / `joinHousehold()` で `/households/{householdId}/members/{uid}` を作成する
  - [x] `getHouseholdMembers()` は `/users` の横断検索ではなく `/households/{householdId}/members` を読む
  - [x] `getHouseholdId()` は `/users/{uid}.householdId` だけでなく、対応する members ドキュメントが未削除であることも確認する
  - [x] 解除時は対象ユーザーの `/users/{uid}` を他メンバーが直接更新せず、`households/{householdId}/members/{uid}.removedAt` を記録する
  - [x] 解除されたメンバーは次回起動時・リスナー権限エラー時に世帯未所属として扱い、世帯作成/参加画面へ戻す
  - [x] 自分自身を解除する場合は「世帯から退出」として扱い、世帯データは削除しない
- [x] Ticket 19: CSV出力の更新（depends on Ticket 8）
  - [x] `lib/csvExport.ts` — `getAllTransactions()` の async 化
  - [x] Firestore から全取引取得 → CSV生成
- [x] Ticket 20: テスト更新（depends on Ticket 8, 17, 18, 19）
  - [x] `lib/accountBalance.test.ts` / `lib/accountBalance.ts` はSQLite層撤去に合わせて削除
  - [x] `lib/csvExport.test.ts` / `lib/csvExportRows.test.ts` — async Firestore取得後のCSV行変換に対応
  - [x] 認証解除時の世帯データ削除・世帯未所属復帰をRulesテストで検証
  - [x] メンバー解除後に対象ユーザーが世帯データへアクセスできないことをRulesテストで検証
  - [x] 同一取引を複数端末から更新・削除した場合に、transactions と accounts.balance が不整合にならないよう残高調整を純関数化し、更新/削除をFirestore transaction化
  - [x] Firestore エミュレータを使ったRulesテスト環境構築（`firebase.json`, `firestore.rules.test.ts`, `npm run test:rules`）
  - [x] Rulesテスト実行にはJava 21以上が必要。JDK 25を指定して `npm run test:rules` 成功
- [x] Ticket 21: expo-sqlite 削除 & クリーンアップ（depends on Ticket 11-19）
  - [x] SQLite → Firestore 移行ツールは作らない。既存SQLiteデータは破棄する
  - [x] `npm uninstall expo-sqlite`
  - [x] `lib/database.ts` 削除
  - [x] `lib/accountBalance.ts` 削除（ロジックは `firestore.ts` のバッチ書き込みに吸収）
  - [x] ARCHITECTURE.md / CLAUDE.md / copilot-instructions.md 更新
- [x] Ticket 22: プライバシー対策の本番化（depends on Ticket 7, 17, 18）
  - [x] Firestore Security Rulesを再確認し、自世帯以外・解除済みメンバー・削除済み世帯への読み書きが拒否されることをテストに追加する
  - [x] Security Rulesに activeMember 判定を追加し、`members/{uid}.removedAt` があるユーザーは旧世帯データを読めないルールにする
  - [x] `/users` コレクションの横断読み取りに依存しない設計にする
  - [x] Firebase App Checkクライアント導入（`@react-native-firebase/app-check`、起動時JS初期化、dev=debug / prod=App Attest fallback + Play Integrity）。Expo config pluginはSwift AppDelegateでFirebase二重初期化の可能性があるため無効化
  - [x] App Check本体は導入済み。Expo config plugin / ネイティブ初期化の再導入を再トライし、起動前クラッシュが再発しないか TestFlight で確認する
  - [x] App Check enforcement有効化前に、JS初期化のみの構成でTestFlight/dev-clientからApp Checkトークンが取得できることを確認する（2026-05-10: App Check指標で確認済みリクエスト 91/91, 100%）
  - [x] 招待コードの再発行導線を設定画面に追加し、古い `/inviteCodes/{code}` を削除する
  - [x] 招待コードは6文字のまま維持し、コード入力後は即参加ではなく `joinRequests` に承認待ちとして登録する
  - [x] 既存世帯メンバーが設定画面で参加リクエストのニックネームを確認し、承認/拒否できる導線を追加する
  - [x] 参加希望者のニックネーム入力を必須にし、空文字・長すぎる名前・紛らわしい名前のバリデーションを追加する
  - [x] 招待コードに `expiresAt` / `disabledAt` を持たせ、有効期限切れ・再発行済みコードでは参加できないようにする
  - [x] 招待コード参加の総当たり対策として、失敗回数・クールダウン・App Check enforcement・必要ならCloud Functions経由のレート制限を検討する
  - [x] `/inviteCodes/{code}` の直接 `get` 方式を継続する（Cloud Functions 化は将来再検討）
  - [x] 保存する個人情報を最小化し、メールアドレス・氏名を永続保存しないことを確認する（Apple Sign-Inのメール/氏名スコープ要求を停止、Firestore保存名は汎用表示名に限定）
  - [x] App Store申請前にプライバシーポリシーを作成し、データ保存範囲・共有範囲・削除方法を明記する（`docs/privacy-policy.md`）

#### Phase 3 対象ファイル

| 操作     | ファイル                                   | 内容                                   |
| -------- | ------------------------------------------ | -------------------------------------- |
| 新規     | `lib/firestore.ts`                         | 全44関数のFirestore版                  |
| 新規     | `lib/auth.ts`                              | 認証ロジック                           |
| 新規     | `lib/household.ts`                         | 世帯管理                               |
| 新規     | `hooks/useFirestore.ts`                    | リアルタイムリスナー                   |
| 新規     | `app/auth.tsx`                             | ログイン画面                           |
| 新規     | `app/household.tsx`                        | 世帯作成/参加画面                      |
| 新規     | `firestore.rules`                          | セキュリティルール                     |
| 新規     | `eas.json`                                 | EAS Build設定                          |
| 大幅変更 | `app/_layout.tsx`                          | 認証ガード + 初期化変更                |
| 大幅変更 | 全5タブ + `TransactionEditor.tsx`          | sync → async + リスナー                |
| 大幅変更 | `lib/csvExport.ts`                         | async化                                |
| 大幅変更 | `lib/settingsManagerEditor.ts`             | DB型importのFirestore化                |
| 大幅変更 | `app/(tabs)/settings.tsx`                  | 世帯情報・メンバー解除・認証解除       |
| 大幅変更 | `firestore.rules`                          | activeMember判定・削除済みメンバー遮断 |
| 設定変更 | `app.json`, `package.json`                 | Firebase plugin / deps                 |
| 削除     | `lib/database.ts`, `lib/accountBalance.ts` | SQLite層撤去                           |

#### Phase 3 検証項目・あとでユーザーが確認すること

TestFlight/dev-clientでの確認項目、App Check enforcement前確認、App Store申請前確認は [docs/release-checklist.md](docs/release-checklist.md) を参照する。

#### Phase 3 除外スコープ

- Push通知（家族が記録したときの通知）→ Phase 4以降
- Cloud Functions（集計の事前計算など）→ 必要になるまで見送り
- 複数世帯への所属 → サポートしない（1ユーザー = 1世帯）
- Android対応 → iPhoneのみ

### 🔲 Phase 4 — App Store配布

App Store配布前の確認項目は [docs/release-checklist.md](docs/release-checklist.md#phase-4-app-store配布) を参照する。

#### AI活用・開発運用の改善

AI活用、外部ツール、レビュー、知見退避ルールの詳細は [docs/ai-development.md](docs/ai-development.md) を正とする。

#### 収益化・価格設定の検討

価格設定、課金単位、Firestore原価試算、有料化の価値説明は [docs/privacy-and-monetization.md](docs/privacy-and-monetization.md#収益化価格設定の検討) を参照する。

#### 有料化時のプライバシー・クレーム予防

有料化時のプライバシー、問い合わせ、IAM権限、サポートログ、解約/返金/障害対応は [docs/privacy-and-monetization.md](docs/privacy-and-monetization.md#有料化時のプライバシークレーム予防) を参照する。

---

## 積み残し・検討事項

### UI省スペース化・履歴検索改善

- [x] 実装済み: 各タブのヘッダー（記録、履歴、集計、設定など）を削除し、縦方向の表示領域を広げる（TestFlight build 20で確認済み）
- [x] 実装済み: 記録タブの各入力コンテナ見出し（金額、日付、口座、カテゴリなど）を削除し、入力欄・選択状態だけで意味が伝わるレイアウトにする（TestFlight build 20で確認済み）
- [x] 実装済み: カテゴリ選択後はモーダル内を内訳選択だけに切り替え、内訳なしカテゴリは即確定、内訳ありカテゴリでは内訳選択を必須にする（TestFlight build 20で確認済み）
- [x] 実装済み: 内訳が選択されている場合は、記録タブ上で `カテゴリ - 内訳` の形式で表示する（TestFlight build 20で確認済み）
- [x] 実装済み: 内訳選択肢の表示領域を常時確保せず、スペースを圧迫しないようにする（TestFlight build 20で確認済み）
- [x] 実装済み: さらなる省スペース化のため、内訳選択肢を記録タブ本体ではなくカテゴリ選択モーダル内で選ぶようにする（TestFlight build 20で確認済み）
- [x] 実装済み: ヘッダー削除後もiPhoneのノッチエリアにかぶらないよう、タブ全体にSafe Area上端paddingを適用する（TestFlight build 20で確認済み）
- [x] 実装済み: カテゴリリセット後の過去履歴編集時に、取引スナップショットのカテゴリ名/内訳名から同名の現行マスタを選択状態に復元する（TestFlight build 21で実機確認予定）
- [x] 実装済み: 設定のカテゴリ管理でカテゴリ選択時の表示順を上下移動で変更できるようにし、記録/編集時のカテゴリ選択モーダルへ反映する（TestFlight build 21で実機確認予定）
- [x] 実装済み: 設定の内訳管理でもカテゴリ配下の表示順を変更できるようにし、記録/編集時の内訳選択モーダルへ反映する（issue #6、TestFlight build 30で実機確認済み）
- [x] 実装済み: 集計・履歴・金額入力・口座残高などの数値表示へ等幅数字を適用し、桁を比較しやすくする（issue #5、TestFlight build 30で実機確認済み）
- [x] 実装済み: 履歴タブのリスト表示を、月ごとの分割表示ではなく全データの日付降順表示に変更する（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴タブのリスト表示時だけ検索機能を表示する（カレンダービューでは非表示、TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴タブのリスト検索条件をデフォルト閉状態にし、閉状態でも条件なし/条件数/条件要約が分かるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴検索では、収入/支出をトグルで切り替えられるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴検索では、カテゴリ/内訳/お店を選択条件にできるようにする（収入検索時はお店条件を使わない、TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴検索では、メモを部分一致で検索できるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴検索では、日付の開始日・終了日をそれぞれ任意指定にし、未指定の場合は全期間を対象にする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴検索条件の組み合わせ時に、未指定条件は絞り込み対象にしない（TestFlight build 21で実機確認予定）
- [x] 実装済み: `__DEV__` 限定で設定タブからUIプレビュー画面を開き、固定サンプルデータで履歴検索パネルの見た目と操作をdev-client上で確認できるようにする（TestFlightビルド前の目視確認用）
- [x] 実装済み: 集計タブの月次カテゴリ行、月次収入/支出の合計行、予算進捗行をタップすると、履歴タブの既存検索条件にカテゴリ・種別・対象月を渡し、検索条件パネルは閉状態のまま該当レコード一覧へドリルダウンできるようにする（TestFlight build 21で実機確認予定）

### 検証・信頼性確認

- [x] オフライン利用時に記録したデータが、オンライン復帰後にFirestoreへ同期されることをTestFlight build 14で確認する
- [x] オフライン中に複数端末で同一データを編集した場合の見え方と、last-write-winsによる最終反映結果に問題がないか確認する
- [x] 実装済み: オフライン中の保存状態・同期待ち状態がユーザーに誤解を与えないか確認し、必要ならUI表示を追加する（保存後予算判定と書き込みack待ちを短くし、TestFlight build 21で実機確認予定）
- [x] 実装済み: オフライン記録保存時に「保存中...」状態が残り、続けて複数件記録できない問題を解消する（TestFlight build 21で実機確認予定）
- [x] 実装済み: オフライン中でも記録の編集・削除を受け付け、オンライン復帰後に同期されるようにする（TestFlight build 21で実機確認予定）
- [x] オフライン編集の競合時は last-write-wins を基本にしつつ、競合解決結果をユーザーへ通知するか判断する
- [x] 実装済み: 設定のカテゴリ/内訳管理で、オフライン削除後にタブを開き直さなくても画面へ即時反映されるようにする（TestFlight build 20で確認済み）
- [x] 実装済み: カテゴリリセット後も、既存取引をスナップショット名から同名デフォルトカテゴリ/内訳へ再リンクし、集計タブではID未設定取引もスナップショット名でカテゴリ別に表示する（TestFlight build 21で実機確認予定）
- [x] 実装済み: カテゴリリセット後も、既存取引の店舗スナップショットからお店マスタとカテゴリ別使用履歴を復元する（TestFlight build 21で実機確認予定）
- [x] 実装済み: カテゴリリセット後、店名は表示されているが `storeId` が未復元の過去履歴を編集保存しても、お店名が消えないようにする（TestFlight build 21で実機確認予定）
- [x] 方針更新: 通常の記録・履歴編集・CSV取り込みではお店マスタを参照/更新せず、取引の店名スナップショットから候補を生成する（[docs/decisions/store-candidates-from-transactions.md](docs/decisions/store-candidates-from-transactions.md)）
- [x] 実装済み: 口座管理でマイナス残高を入力できるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 口座管理の残高入力とカテゴリ月次予算入力を、iPhone標準キーボードではなく共通の数値入力モーダルで操作できるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 記録タブと履歴編集の金額入力も、口座管理と同じ共通の金額入力モーダルで四則演算と「計算」確定を操作でき、計算成功時はモーダルが閉じるようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 口座管理で現在値に対する四則演算入力（例: `+1000` / `-500` / `*2` / `/2`）、数値入力モーダル内の計算確定、計算成功時のモーダルクローズ、残高クリア操作をサポートする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 設定変更はマスタ/口座/世帯/削除系の競合が複雑になりやすいため、オフライン中はカテゴリ/内訳、口座、世帯メンバー、招待コード、データ削除/リセットなどの設定変更操作を無効化する（TestFlight build 21で実機確認予定）
- [x] 実装済み: 口座残高は初期残高と取引純額を基準に、口座管理表示時および記録/履歴編集の口座選択時に補正する（TestFlight build 21で実機確認予定）
  - 改訂: 大量データ（CSVインポート）で全件 reconcile が重く、かつインポート分を残高へ折り込む問題が判明したため、**口座選択時/口座管理表示時の自動 reconcile を廃止**。残高は手動設定＋記録/編集/削除の増分のみで維持する（[docs/decisions/account-balance-incremental-only.md](docs/decisions/account-balance-incremental-only.md)）
- [x] 実装済み: 履歴リストは全件購読・全件描画をやめ、`FlatList` + 日付降順カーソルページング（初回100件＋スクロールで追加100件）にする。日付検索時はサーバー側 where で範囲取得。初回/追加ロードとプルリフレッシュにローディング表示を出す（大量データでのフリーズ/クラッシュ対策）
- [x] 実装済み: 記録保存時と履歴編集保存時は購読済み/画面上のカテゴリ/内訳/口座/店舗名をスナップショットとして渡し、さらにFirestore書き込みack待ちを短時間で同期待ち扱いへ切り替えて、オフライン保存時に「保存中...」が固着しにくいようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 記録/履歴編集のカテゴリ選択と履歴一括コピーは、購読済みカテゴリ/内訳を使って候補解決し、オフライン時に未購読マスタ読み取り待ちで固着しにくいようにする（TestFlight build 21で実機確認予定）
- [x] 実装済み: 履歴タブのカレンダー表示と集計タブの期間表示で、年月ピッカーを使って任意の年月へジャンプできるようにする（TestFlight build 21で実機確認予定）

---

## 技術スタック

| 用途           | パッケージ                                          |
| -------------- | --------------------------------------------------- |
| フレームワーク | Expo SDK 54 / React Native 0.81.5                   |
| ルーティング   | expo-router v6                                      |
| DB             | Cloud Firestore（世帯単位のリアルタイム同期）       |
| 認証           | Apple Sign-In + Firebase Auth                       |
| Firebase       | @react-native-firebase/app/auth/firestore/app-check |
| ビルド         | expo-dev-client + EAS Build / TestFlight            |
| CSV出力        | expo-file-system/legacy + expo-sharing              |
| 課金           | expo-iap（CSVインポート解放の非消耗型IAP）          |
| 招待QR         | expo-camera（読み取り）+ qrcode-generator（生成）   |
| 日付入力       | @react-native-community/datetimepicker              |
