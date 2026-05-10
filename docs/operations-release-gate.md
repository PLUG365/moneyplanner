# リリース前運用ゲート方針

最終更新日: 2026-05-10

## 目的

App Store配布前に、運用事故（過剰課金、誤削除、監視漏れ、機微情報露出）を減らすための共通運用ルールを定める。

## 1. 環境分離方針

- 開発環境: ローカル + Firestore Emulator を基本とし、実データを使わない
- 検証環境: TestFlight / dev-client で動作確認する
- 本番環境: App Store配布ビルドのみが利用する
- EAS secrets は用途別に分離し、本番用secretを開発用途で使わない
- App Checkは本番でenforcement有効化前に、TestFlight/dev-clientでトークン取得確認を必須化する

## 2. 請求監視運用

- リリース直後（初週）は毎日、Firebase/GCP請求ダッシュボードを確認する
- 安定後は週次確認、月末に月次集計を行う
- 予算上限に近づいた場合は、読み取り回数が多い導線（履歴検索・集計）を優先調査する

## 3. バックアップ/復旧運用

- 本番データの定期エクスポート手順を運用手順として保持する
- 復旧手順は「対象範囲の特定 → 復旧可否判断 → リストア実施 → 件数確認」の順で実施する
- 削除系機能（認証解除と全データ削除、世帯退出/メンバー解除）は、リリース前にテストデータで事前確認する

## 4. データモデル変更時の移行運用

- Firestoreデータモデル変更時は、いきなり本番へ適用しない
- テストデータで移行手順・ロールバック手順・件数確認手順を先に実施する
- 変更時は [PLAN.md](../PLAN.md) と [ARCHITECTURE.md](../ARCHITECTURE.md) に反映する

## 5. ログ/監視方針

- 監視対象: クラッシュ、認証失敗、Firestore権限エラー、App Check失敗、同期失敗
- ログに金額・メモ・店舗名・個人情報・認証情報・secretを含めない
- 例外的に本番データ参照が必要な場合は、[docs/operations-data-access-policy.md](operations-data-access-policy.md) の手順に従う

## 6. インシデント初動

- 初動: 影響範囲の切り分け、再発条件の特定、暫定対処
- 連絡: ユーザー告知の要否判断、必要時は告知文を作成
- 事後: 根本原因、再発防止策、実施期限を記録する

## 関連ドキュメント

- [docs/release-checklist.md](release-checklist.md)
- [docs/operations-data-access-policy.md](operations-data-access-policy.md)
- [docs/privacy-policy.md](privacy-policy.md)
- [docs/privacy-and-monetization.md](privacy-and-monetization.md)
