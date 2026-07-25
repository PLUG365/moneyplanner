# 開発者向けドキュメント

moneyplannerの開発、設計、運用に関する文書の入口です。

## 現在の提供状況

App Storeで配信中です。build 34はGuideline 5.1.1(v)〈アカウント削除〉で却下されましたが、アカウント削除導線を改善したビルドが承認され、2026-07-18にバージョン1.0として初回配信を開始しました。現在の公開バージョンは **1.0.1（build 37、2026-07-19承認）** です。次のアップデートはバージョン1.0.2として準備中です。詳細な確認履歴は [TestFlight履歴](testflight-history.md)、リリース判断は [release checklist](release-checklist.md) を参照してください。

## 技術スタック

- Expo SDK 54 / React Native 0.81.5 / TypeScript
- expo-router v6
- Cloud Firestore、Apple Sign-In + Firebase Auth、React Native Firebase（App / Auth / Firestore / App Check）
- expo-dev-client、EAS Build、TestFlight
- expo-file-system/legacy + expo-sharing（CSV出力）
- expo-iap（CSVインポート解放の非消耗型IAP）
- expo-camera + qrcode-generator（招待コードのQR読み取り・生成）

## 文書

- [開発環境セットアップ](development-setup.md): ローカルPCとGitHub Codespacesでの開発
- [開発計画](../PLAN.md): 現在の進捗と未完了タスク
- [アーキテクチャ](../ARCHITECTURE.md): 構成、データモデル、認証、同期方針
- AI作業ルール: [CLAUDE.md](../CLAUDE.md)、[GitHub Copilot instructions](../.github/copilot-instructions.md)、[AI開発方針](ai-development.md)
- リリース・運用: [release checklist](release-checklist.md)、[リリースゲート](operations-release-gate.md)、[TestFlight履歴](testflight-history.md)
- プライバシー・課金: [方針](privacy-and-monetization.md)、[データアクセス方針](operations-data-access-policy.md)、[プライバシーポリシー](privacy-policy.md)
- [意思決定ログ（ADR）](decisions/README.md)
- 監査・ライセンス: [プライバシー監査](app-privacy-audit.md)、[依存関係監査](dependency-audit-2026-05-10.md)、[サードパーティ通知](../THIRD_PARTY_NOTICES.md)
