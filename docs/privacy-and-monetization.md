# プライバシー・収益化方針

課金、プライバシー、問い合わせ、本番データ閲覧制限の方針をまとめる文書です。

## データプライバシー方針

不特定多数のユーザーが利用する前提で、以下を必須要件に含める。

- 世帯データは `households/{householdId}` 配下に閉じ込め、Firestore Security Rulesで自世帯メンバー以外の読み書きを禁止する
- Apple Sign-Inから得る個人情報は最小限にし、アプリDBには `uid`, `householdId`, 表示名程度のみ保存する。メールアドレス・氏名の永続保存は原則行わない
- 有料販売/サブスク化する場合でも、家計簿データをシステム開発・分析・広告・外部提供へ二次利用しない方針を明記し、運用上も開発者がユーザー家計データを閲覧・再利用しない仕組みを検討する
- 招待コードは推測しにくい文字列にし、参加後に再発行できるようにする。将来的には有効期限・再生成・参加済みメンバー確認を追加候補にする
- 設定画面に「アカウントを削除（全データ削除）」を用意し、世帯メンバーであれば誰でも世帯配下の共有データを削除できるようにする
- 世帯未参加ユーザーにも世帯設定画面からアカウント削除導線を用意する（App Store Guideline 5.1.1(v): アカウント作成があるアプリはアカウント削除必須。build 34却下対応）
- 設定画面に「メンバー解除」を用意し、世帯メンバーであれば他メンバーを世帯から解除できるようにする
- メンバー解除時は `households/{householdId}/members/{uid}` に `removedAt` を記録し、この members ドキュメントを世帯アクセス権の正とする。対象ユーザーの `/users/{uid}.householdId` は本人以外が安全に更新できないため、次回起動時にアプリ側で解除状態を検知してクリアする
- 解除済みメンバーの端末に残ったFirestoreローカルキャッシュはサーバー側から即時消去できないため、アプリ起動時・認証状態変更時・リスナー権限エラー時にローカル状態を破棄して世帯作成/参加画面へ戻す
- アカウント削除時は、現在のユーザーのFirebase Authアカウント削除（アプリ側の認証解除）、Apple Sign-Inトークンの失効（`revokeToken`。Sign in with Apple併用アプリのApple要件）、`/users/{uid}` 削除、`households/{householdId}` 配下の全サブコレクション削除を同時に行う
- 他メンバーのFirebase Authアカウントは削除できないため、世帯データ削除後に他メンバーが起動した場合は「世帯が存在しない」状態として扱い、世帯作成/参加画面へ戻す
- アカウント削除は取り消せない操作として、確認ダイアログ・説明文・可能なら再認証を挟む
- Firebase App Checkクライアントを導入し、enforcement有効化前にTestFlight/dev-clientでトークン取得を確認する
- プライバシーポリシーをApp Store申請前に用意し、保存されるデータ、共有範囲、削除方法を明記する

## 収益化・価格設定の検討

Firestore利用料が継続的に発生するため、App Store配布前に有料販売またはサブスク化を検討する。価格はFirebase/Auth/App Check/Firestoreの想定コスト、Apple手数料、家族共有の利用人数、サポート負荷、競合家計簿アプリの価格帯を踏まえて決める。

> Firestore原価とApple手数料控除後の価格シナリオは [docs/firestore-read-and-index-plan.md#具体的な月次原価試算料金決定の根拠](firestore-read-and-index-plan.md) を参照。1世帯あたり実勢¥0.1〜¥5/月程度で、DB原価は価格決定の主因ではない見込み。

- [x] 価格モデルは、基本機能無料 + CSVインポート機能の非消耗型IAP（買い切り）を採用方針にする
- [x] CSV出力は無料のまま提供し、ユーザー自身の家計データを取り出せる安心感を保つ
- [x] 課金単位はApple ID単位の非消耗型IAPとし、世帯単位課金やサブスクは初期リリースでは採用しない
- [x] Firestoreの想定読み書き回数・保存容量・App Check/Firebase関連コストから、1世帯あたりの月次原価を試算する（`docs/firestore-read-and-index-plan.md`）
- [x] CSVインポート買い切り価格は初期リリースでは ¥300 とする
- [x] 初期リリース価格は競合調査前でも買いやすさを優先して ¥300 とし、競合家計簿アプリのCSVインポート/データ移行機能の有料・無料範囲は将来の価格改定や機能追加時に再調査する
- [x] 初期リリースではサブスクを採用しないため、無料トライアル、年額割引、解約後の同期停止などの設計は不要
- [x] 有料化の価値説明として、CSV出力は無料、CSVインポートは買い切りIAP（¥300）で利用可能、家計データを人質にしない方針をApp Store説明文ドラフトに反映する

### CSVインポートIAP実装メモ

- 実装構成: ゲート判定は `lib/csvImportPurchaseGate.ts`（純関数）、購入/復元は `lib/csvImportIap.ts`（expo-iap）、画面配線は `hooks/useCsvImportPurchase.ts` と設定タブ
- `EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED=1` のビルドでのみ課金ゲートが有効になる。未設定のビルドではStoreKitへ接続せず、現行CSV取り込み挙動を維持する
- ゲート有効時、未購入状態で取り込みを実行すると、機能説明・価格（¥300）・「購入」「購入を復元」導線をアラートで表示する
- 本番の購入判定はStoreKitのエンタイトルメント（expo-iapの `getAvailablePurchases`）を正とする。購入/復元成功時に端末ローカル（documentDirectoryのJSON）へキャッシュし、起動直後・オフライン時はキャッシュで判定する
- 一時的な検証用に `EXPO_PUBLIC_CSV_IMPORT_UNLOCKED=1` で購入済み扱いにできる（本番ビルドでは使わない）
- dev-clientでのゲートON/OFF切替はビルド不要。Metro起動時の環境変数で切り替える（審査用スクショ撮影・Sandboxテストで使用）:

  ```powershell
  # ゲートON（購入アラートが出る状態）
  $env:EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED = "1"
  npx expo start -c

  # ゲートOFF（通常状態に戻す。またはPowerShellウィンドウを閉じて起動し直す）
  Remove-Item Env:EXPO_PUBLIC_CSV_IMPORT_IAP_ENABLED
  npx expo start -c
  ```

  `-c`（キャッシュクリア）を忘れると切替が反映されないことがある。TestFlight（production）ビルドのみ、EAS Build側の環境変数として焼き込みが必要
- App Store Connect側の非消耗型プロダクト `csv_import_unlock`（¥300）は作成済みで、Family Sharingは無効（2026-07-11確認）。Sandbox dev-clientでは2026-07-03に購入・復元・キャンセル・未購入アカウントでの復元を確認済み、TestFlight実機でも購入アラート表示・購入/復元・キャンセル導線を確認済み（[docs/release-checklist.md](release-checklist.md)）

## 有料化時のプライバシー・クレーム予防

有料アプリでは「支払ったのに使えない」「解約したらデータが消えた」「開発者に家計データを見られるのでは」といった不安がクレームにつながりやすいため、事前に仕様・規約・UIで説明できる状態にする。

- [x] プライバシーポリシーに、家計簿データを開発・分析・広告・外部提供へ二次利用しないことを明記する（`docs/privacy-policy.md`）
- [x] 開発者/運用者が本番Firestoreのユーザー家計データを日常的に閲覧しない運用ルールを作る（`docs/operations-data-access-policy.md`）
- [x] 問い合わせ調査で本番データ確認が必要な場合の同意取得・閲覧範囲・記録・削除手順を決める（`docs/operations-data-access-policy.md`）
- [x] Firebase Console/IAM権限を最小化し、本番データにアクセスできるGoogleアカウントを限定する方針を決める（`docs/operations-data-access-policy.md`）
- [x] サポート用ログには金額・メモ・店舗名などの家計明細を含めない方針にする（`docs/operations-data-access-policy.md`）
- [x] 課金状態とFirestore利用権限は分離し、未購入でも記録追加・同期・閲覧・CSV出力は利用可能、CSVインポートのみ購入済み判定で解放する
- [x] 返金・復元購入・機種変更・Apple ID変更・家族メンバー追加時のCSVインポート利用可否をヘルプ/FAQにまとめる（`docs/app-store-submission-draft.md`）
- [x] 障害時の告知方法、復旧方針、データ復旧できない場合の説明方針を用意する（`docs/operations-release-gate.md`）
- [x] 「アカウントを削除（全データ削除）」「世帯削除」「メンバー解除」はCSVインポート購入状態に関係なく実行可能とする
