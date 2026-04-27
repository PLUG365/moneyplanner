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
- 家族共有: 世帯単位、Cloud Firestore + Apple Sign-In（Phase 3実装済み、TestFlight検証中）

### 画面構成（タブ5つ）

| タブ             | 内容                            |
| ---------------- | ------------------------------- |
| 記録（初期画面） | 収支入力フォーム                |
| 履歴             | リスト表示 / カレンダービュー   |
| 集計             | 月次・年次・カテゴリ別          |
| 計画             | ライフプラン（Phase 2）         |
| 設定             | カテゴリ管理・CSV出力・世帯管理 |

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

### 🚧 Phase 3 — 家族共有（Firebase移行・TestFlight検証中）

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
- **既存SQLiteデータ**: 移行しない。Phase 3移行時点で破棄し、Firestore上で新規データとして開始する
- **ビルド**: expo-dev-client へ移行（React Native Firebase がネイティブモジュール必須）
- **競合解決**: 同一レコードへの同時更新は `serverTimestamp()` による last-write-wins

> 現在はSQLite置換実装とEAS production buildは完了済み。TestFlight build 14で実機検証中。

#### Firestore データモデル

```text
/users/{userId}
  - householdId: string
  - displayName: string
  - createdAt: Timestamp

/households/{householdId}
  - createdBy: string (userId)
  - inviteCode: string (6桁、参加用)
  - createdAt: Timestamp

  /members/{userId}
    - displayName: string
    - joinedAt: Timestamp
    - removedAt?: Timestamp

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

  /budgets/{categoryId}
    - categoryId, amount
    - updatedAt: Timestamp

  /planLifeEvents/{eventId}
    - eventType, paramsJson
    - createdAt, updatedAt: Timestamp

  /planProfile (単一ドキュメント: id="default")
    - payloadJson
    - updatedAt: Timestamp
```

#### 集計クエリに関する注意

FirestoreにはSQLiteの `GROUP BY + SUM` 相当のサーバーサイド集計を直接置き換える仕組みがないため、`transactions` を取得してJSで集計する方式を採用（家計簿の月次データ量なら十分実用的）。集計ロジックは `lib/summaryAggregation.ts` に分離し、集計タブとFirestore API側で再利用する。

#### Firebase置換の完了条件

Phase 3では、SQLiteで実装済みの全機能をFirestore/Firebase Authへ置換する。記録・履歴・集計・設定・カテゴリ/内訳・店舗・口座・予算・ライフプラン・CSV出力の全導線はFirestoreデータのみで動作する実装へ移行済み。既存SQLiteデータの移行は行わず、移行後は新規Firestoreデータとして開始する。

#### 画面移行の共通方針

- SQLite版の `number` ID は Firestore版ではすべて `string` ID に統一する。`DEFAULT_ACCOUNT_ID` は `1` ではなく `default` を使う
- 各画面・コンポーネントの state / props / 選択ID / Mapキー / テスト用モックも `number` から `string` へ更新する
- 既存の同期DB呼び出しは `async/await` に置き換え、保存・更新・削除中は二重送信防止のローディング状態を持たせる
- マスタデータ・表示中の月の取引一覧・世帯情報はリアルタイムリスナーを優先し、集計値は表示対象期間の `transactions` を取得してクライアント側で再計算する
- リスナーの `permission-denied` や世帯未所属検出時は `clearHouseholdCache()` と画面状態リセットを行い、世帯作成/参加画面へ戻す

#### データプライバシー方針

不特定多数のユーザーが利用する前提で、以下をPhase 3の必須要件に含める。

- 世帯データは `households/{householdId}` 配下に閉じ込め、Firestore Security Rulesで自世帯メンバー以外の読み書きを禁止する
- Apple Sign-Inから得る個人情報は最小限にし、アプリDBには `uid`, `householdId`, 表示名程度のみ保存する。メールアドレス・氏名の永続保存は原則行わない
- 招待コードは推測しにくい文字列にし、参加後に再発行できるようにする。将来的には有効期限・再生成・参加済みメンバー確認を追加候補にする
- 設定画面に「認証解除と全データ削除」を用意し、世帯メンバーであれば誰でも世帯配下の共有データを削除できるようにする
- 設定画面に「メンバー解除」を用意し、世帯メンバーであれば他メンバーを世帯から解除できるようにする
- メンバー解除時は `households/{householdId}/members/{uid}` に `removedAt` を記録し、この members ドキュメントを世帯アクセス権の正とする。対象ユーザーの `/users/{uid}.householdId` は本人以外が安全に更新できないため、次回起動時にアプリ側で解除状態を検知してクリアする
- 解除済みメンバーの端末に残ったFirestoreローカルキャッシュはサーバー側から即時消去できないため、アプリ起動時・認証状態変更時・リスナー権限エラー時にローカル状態を破棄して世帯作成/参加画面へ戻す
- 認証解除時は、現在のユーザーのFirebase Authアカウント削除（アプリ側の認証解除）、`/users/{uid}` 削除、`households/{householdId}` 配下の全サブコレクション削除を同時に行う
- 他メンバーのFirebase Authアカウントは削除できないため、世帯データ削除後に他メンバーが起動した場合は「世帯が存在しない」状態として扱い、世帯作成/参加画面へ戻す
- 認証解除は取り消せない操作として、確認ダイアログ・説明文・可能なら再認証を挟む
- Firebase App Checkを有効化し、正規アプリ以外からのFirestoreアクセスを抑制する
- プライバシーポリシーをApp Store申請前に用意し、保存されるデータ、共有範囲、削除方法を明記する

#### 要件見直し候補

- 「世帯メンバーであれば誰でも全データ削除可能」は誤操作・悪用時の影響が大きい。最低限、確認入力・再認証・削除前CSV出力導線を必須にする。必要なら将来、世帯オーナー/管理者ロールを追加して権限を分ける
- 「世帯メンバーであれば誰でも他メンバー解除可能」も同様に強い操作のため、少なくとも自分自身の解除は「世帯から退出」として別UIにし、最後の1人を解除/退出する場合の扱い（世帯データ削除するか残すか）を明確化する
- 招待コードは現状の恒久コードだけだと漏えい時に参加され続けるため、再発行・無効化・有効期限の要否を設定画面実装前に決める

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
  - `eas build --platform ios --profile production --non-interactive`
  - build `8ad7e95e-2327-4e07-8469-2d9f508d62aa` / app build `1.0.0 (10)` 成功
  - iOS app artifact: `https://expo.dev/artifacts/eas/i9pGsZjiyn6vQSBQzeQmyJ.ipa`
  - App Store Connect / TestFlight へ手動submit済み（処理完了後にTestFlightで実機確認）
  - TestFlight build 10 は起動前クラッシュ。App Check Expo config plugin によるSwift AppDelegateのFirebase二重初期化疑いでpluginを無効化し、JS初期化のみへ変更
  - 修正版 build `fe6b9964-2aca-4e4f-bf55-917697a77b97` / app build `1.0.0 (12)` は起動成功。世帯作成時に招待コード生成エラーが発生
  - 世帯作成前の `/inviteCodes/{code}` 事前readを撤去し、ローカル生成した6桁コードを作成batch内で書き込む方式へ変更
  - 招待コード修正版 build `3f3085b1-e356-45cf-8e9b-90ed01e9b65d` / app build `1.0.0 (13)` をEAS Build中
  - build 13 は世帯作成・レコード追加まで成功。記録タブ保存後に `Cannot read property 'amount' of undefined` が発生
  - React Native Firebase v24 の `DocumentSnapshot.exists()` メソッドをプロパティとして参照していた箇所を修正し、予算未設定時の保存後予算チェックがnullで終わるように変更
  - 記録タブへ戻った時に金額欄などの入力値が残らないよう、フォーカス時フォームリセットを復元
  - 保存後エラー修正版 build `c08c5c26-fdc6-47ed-bd14-a31b7d2c4cf3` / app build `1.0.0 (14)` 成功
  - iOS app artifact: `https://expo.dev/artifacts/eas/pM3L6TSpFZjkPnVEhxm4Nc.ipa`

#### Phase 3-A ビルド設定メモ

- `GoogleService-Info.plist` はGitに含めず、EAS production環境の file secret `GOOGLE_SERVICE_INFO_PLIST` として渡す
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
  - 招待コード: 6桁ランダム生成、`/households/{id}.inviteCode` に保存
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
- [x] Ticket 14: `app/(tabs)/plan.tsx`（計画タブ）更新（parallel with Ticket 11）
  - [x] ライフイベント・プロフィールの Firestore async化
  - [x] ライフイベントIDをFirestore string ID対応へ更新
  - [x] 年次実績の初期値反映をFirestore集計から取得
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
- [ ] Ticket 22: プライバシー対策の本番化（depends on Ticket 7, 17, 18）
  - [x] Firestore Security Rulesを再確認し、自世帯以外・解除済みメンバー・削除済み世帯への読み書きが拒否されることをテストに追加する
  - [x] Security Rulesに activeMember 判定を追加し、`members/{uid}.removedAt` があるユーザーは旧世帯データを読めないルールにする
  - [x] `/users` コレクションの横断読み取りに依存しない設計にする
  - [x] Firebase App Checkクライアント導入（`@react-native-firebase/app-check`、起動時JS初期化、dev=debug / prod=App Attest fallback + Play Integrity）。Expo config pluginはSwift AppDelegateでFirebase二重初期化の可能性があるため無効化
  - [x] 招待コードの再発行導線を設定画面に追加し、古い `/inviteCodes/{code}` を削除する
  - [x] 保存する個人情報を最小化し、メールアドレス・氏名を永続保存しないことを確認する（Apple Sign-Inのメール/氏名スコープ要求を停止、Firestore保存名は汎用表示名に限定）
  - App Store申請前にプライバシーポリシーを作成し、データ保存範囲・共有範囲・削除方法を明記する

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

#### Phase 3 検証項目

1. EAS Build で開発ビルドが iOS に正常インストールされること
2. Apple Sign-In でログインし、`/users/{uid}` ドキュメントが作成されること
3. 世帯作成 → 招待コード生成 → 別アカウントで参加できること
4. 記録タブで収支登録 → 別端末でリアルタイムに反映されること
5. 同一レコードを2端末から更新 → 最後の書き込みが両端末に反映されること（last-write-wins）
6. オフラインで記録 → オンライン復帰時に自動同期されること
7. 集計タブの数値が Firestore データと一致すること
8. CSV出力が Firestore データから正しく生成されること
9. 設定画面から認証解除すると、現在のユーザーの認証情報と世帯配下のFirestoreデータが削除されること
10. 世帯データ削除後、他メンバーが起動すると世帯作成/参加画面へ戻ること
11. 設定画面からメンバー解除すると、解除されたメンバーが次回アクセス時に世帯データへアクセスできなくなること
12. 既存SQLiteデータを移行せず破棄しても、Firestore上で全機能が新規データとして動作すること

#### あとでユーザーが確認すること

- [ ] TestFlightまたはdev-clientでApple Sign-Inが通り、ログイン後に世帯作成/参加画面へ遷移すること
- [ ] 2つのApple IDで世帯作成 → 招待コード参加 → 記録タブの追加内容が別端末の履歴タブへリアルタイム反映されること
- [ ] メンバー解除後、解除された側が次回起動時に世帯データへアクセスできず、世帯作成/参加画面へ戻ること
- [ ] 「認証解除と全データ削除」でCSV出力の必要性を確認したうえで、確認入力・Apple再認証・Authアカウント削除・Firestore世帯データ削除が完了すること
- [ ] 世帯データ削除後、他メンバーのAuthアカウントは残りつつ、次回起動時に世帯未所属として扱われること
- [x] Java 21以上のJDKを導入し、`npm run test:rules` でFirestore Rulesテストを実行する
- [x] Firestore EmulatorでSecurity Rulesを確認し、自世帯以外・解除済みメンバー・削除済み世帯への読み書きが拒否されること
- [ ] Firebase ConsoleでApp Checkを登録し、FirestoreのApp Check enforcement有効化前にdev-client/TestFlightでトークン取得を確認すること
- [ ] App Store申請前にプライバシーポリシー、招待コード再発行/無効化の要否を最終判断すること

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

| 用途           | パッケージ                                          |
| -------------- | --------------------------------------------------- |
| フレームワーク | Expo SDK 54 / React Native 0.81.5                   |
| ルーティング   | expo-router v6                                      |
| DB             | Cloud Firestore（世帯単位のリアルタイム同期）       |
| 認証           | Apple Sign-In + Firebase Auth                       |
| Firebase       | @react-native-firebase/app/auth/firestore/app-check |
| ビルド         | expo-dev-client + EAS Build / TestFlight            |
| CSV出力        | expo-file-system/legacy + expo-sharing              |
| 日付入力       | @react-native-community/datetimepicker              |
