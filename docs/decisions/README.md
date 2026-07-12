# 意思決定ログ

重要な設計判断、方針転換、採用/不採用理由を記録する場所です。

## 一覧

- [Cloud Firestore移行](firestore-migration.md)
- [計画タブ廃止](plan-feature-retirement.md)
- [招待コード参加の総当たり対策](invite-join-bruteforce-mitigation.md)
- [口座残高の増分維持方針（自動reconcile廃止）](account-balance-incremental-only.md)
- [CSVインポートの未知口座はnull紐付け](import-unknown-account-nullable.md)
- [世帯削除フローの恒久方針](household-deletion-flow.md)
- [取引のソフトデリート採用](transaction-soft-delete.md)
- [お店候補は取引スナップショットから生成](store-candidates-from-transactions.md)
- [CSVインポートIAPは初期リリースでFamily Sharingを無効化](csv-import-iap-family-sharing.md)

新しい重要判断を追加した場合は、この一覧と [開発者向けドキュメント](../development.md) の更新要否も確認します。
