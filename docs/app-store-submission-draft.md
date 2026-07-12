# App Store 提出情報ドラフト

最終更新日: 2026-07-12

## 目的

App Store Connect で最終入力する前に、プライバシー栄養表示・公的データ利用有無・課金説明・返金/解約説明の文案を先に揃える。

## 公開タイトル

公開表示タイトルは `NANBO - みんなの家計簿` とする。App Store Connect、プライバシーポリシー、リリースメタデータでこの表記を一貫して使用する。

## 1. プライバシー栄養表示（確認用ドラフト）

ソース監査、build 31 archive inspection、詳細な判断保留事項は [docs/app-privacy-audit.md](app-privacy-audit.md) を正とする。ここでは App Store Connect の暫定選択だけを要約する。

従来の「3種類だけ」の要約は、build 31 archive inspectionでGoogle Analytics SDKの存在を確認したため、この内容に置き換える。

暫定の入力候補:

- `User ID`、`Other Financial Info`、`Other User Content` は、家計簿、世帯共有、招待・参加機能のFirestore保存内容を根拠に候補とする。利用目的は `App Functionality`、ユーザーへの紐付けは `Linked to the user`、トラッキングは `Not used for tracking` の暫定案である
- `Other Diagnostic Data`、`Product Interaction`、`Coarse Location` をAnalytics由来の追加候補とする。利用目的は `Analytics` の暫定案である
- 追加3候補のユーザーへの紐付けとトラッキングは、Google Analytics設定（Google signals、Google Adsリンク、データ共有）の人間レビューが終わるまで確定しない
- build 31では広告SDK・ATT/IDFA関連のシンボルを確認していないが、これだけを根拠にAnalytics由来データを最終的に「Not used for tracking」とはしない

注:

- この内容は未入力のドラフトであり、App Store Connect の値を入力済みであることを示さない
- `Purchase History`、`Device ID`、`Other Data`、`Name` は最終化しない。StoreKit利用時のIAP自動イベント、App Check、招待メタデータ、およびニックネームの扱いを人間が確認する
- 2026-07-11、Analytics収集を無効化する方向で決定した（詳細は [app-privacy-audit.md](app-privacy-audit.md) の「最終化前のプロダクト判断」参照）。`app.json` へ `FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED: true` を設定済みだが、次回buildでのproduction archive再確認とTestFlight再検証が未完了であり、App Store Connectの最終入力をブロックしている
- 最終確定は App Store Connect の入力値で行い、リリース時点の実装と `docs/privacy-policy.md` との整合を人間がレビューする

## 2. 公的データ出典（現行版は非該当）

現行版ではライフプラン機能を廃止済みのため、公的統計データを同梱・加工利用しない。

App Store説明文、プライバシーポリシー、アプリ内表示に、公的統計データ由来のシミュレーション初期値や出典表記は入れない。将来、公的データを使う機能を再導入する場合は、利用データ、加工内容、出典ID、表示文案をこの節へ追加し、人間レビューを行う。

確認観点:

- App Store Connect の説明文に、公的統計データ利用を示唆する文言が残っていないこと
- アプリ内・サポート文書・プライバシーポリシーに、ライフプラン/シミュレーション初期値の説明が残っていないこと
- 将来再導入する場合は、[docs/decisions/plan-feature-retirement.md](decisions/plan-feature-retirement.md) との関係を整理すること

## 3. 課金説明（CSVインポート買い切りIAP）

採用方針:

- 基本機能、世帯共有、CSV出力は無料で提供する
- CSVインポートは非消耗型のアプリ内課金（買い切り）でロック解除する
- CSV出力は無料のまま残し、ユーザー自身の家計データを取り出せる状態を保つ
- 未購入時も記録追加、同期、閲覧、CSV出力、認証解除と全データ削除は制限しない

表示文案（App Store説明/アプリ内購入説明向け）:

- CSV出力は無料で利用できます。
- CSVインポートは買い切りのアプリ内課金（¥300）でロック解除できます。
- CSVインポートを使うと、エクスポート済みCSVや対応形式のCSVから取引データをまとめて取り込めます。
- CSVインポートの購入は購入したApple IDに紐づき、Family Sharingでは共有されません。

注:

- App Store Connectの非消耗型プロダクトIDは `csv_import_unlock`、価格は ¥300。Family Sharingは無効（2026-07-11確認）
- CSVインポート未購入時は、取り込みボタン押下時に機能説明、価格、購入/復元導線を表示する
- 課金に関係なく、ユーザー自身のデータ削除とCSV出力は利用できるようにする

## 4. 返金/復元説明（文案テンプレート）

- CSVインポートは買い切りのアプリ内課金です。サブスクリプションではありません。
- 購入済みの場合は、同じApple IDで復元購入できます。
- 返金の可否・手続きは Apple のポリシーに従います。
- 返金申請は Apple の購入履歴画面から実施してください。

## 5. CSVインポートIAP FAQ（ヘルプ文案）

- **機種変更した場合**: 同じApple IDでサインインし、「購入を復元」からCSVインポート機能を復元できます。
- **通常のアプリデータを引き継ぐ場合**: 機種変更後の端末で、以前と同じApple IDでAppleでサインインすると、同じFirestore世帯に保存されたデータを利用できます。別のApple IDでは、有効な招待コードで世帯に参加する必要があります。この動作は実機での確認未了です。
- **Apple IDを変更した場合**: 購入はApple IDに紐づくため、新しいApple IDへ自動移行されません。必要に応じてAppleの購入履歴/サポートを確認してください。
- **家族メンバーを追加した場合**: アプリ内の世帯共有とAppleのFamily Sharingは別の仕組みです。CSVインポートの購入は購入したApple IDに紐づき、Family Sharingは無効のため家族へ共有されません。
- **返金した場合**: 返金後の利用可否はAppleの処理結果とアプリ内の購入状態に従います。返金可否はAppleの判断です。
- **CSV出力について**: CSV出力は購入状態に関係なく無料で利用できます。
- **データ削除について**: 認証解除と全データ削除、世帯削除、メンバー解除は購入状態に関係なく利用できます。

## 6. リリース前チェック

1. App Store Connect 入力値と `docs/privacy-policy.md` の整合
2. `NANBO - みんなの家計簿` の表示名が App Store Connect、プライバシーポリシー、リリースメタデータで一致していること
3. 公的統計データ利用がない前提と、App Store説明文/アプリ内文言の整合
4. CSVインポートIAPの価格、プロダクトID、購入/復元文面の最終反映
5. CSVインポートIAP FAQと実装/ App Store Connect 設定の整合
6. 問い合わせ導線（メール/URL）の最終反映

## 関連ドキュメント

- `docs/privacy-policy.md`
- `docs/privacy-and-monetization.md`
- `docs/release-checklist.md`
