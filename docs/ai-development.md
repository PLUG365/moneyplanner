# AI活用・開発運用

AI活用、外部ツール、レビュー、知見退避ルールをまとめる文書です。

`GitHub Copilotのススメ` と `GitHub Copilot プロンプトリファレンス [2026年1月版]` の知見を踏まえ、AIに実装を任せる範囲が広がっても、目的・完了条件・検証・権限範囲を明文化して安全に進める。

## 改善項目

- [ ] TestFlight安定版、Firestore本番化、App Check enforcement、App Store申請、有料化開始のリリース判定ゲートを定義する
- [ ] 各ゲートについて、必須テスト、実機確認、ドキュメント更新、ユーザー確認項目、未解決リスクをチェックリスト化する
- [ ] ドキュメントのSSOTを明確化し、進捗は [PLAN.md](../PLAN.md)、構成/データモデルは [ARCHITECTURE.md](../ARCHITECTURE.md)、リポジトリ固有のAI実行ルールは [CLAUDE.md](../CLAUDE.md) / [.github/copilot-instructions.md](../.github/copilot-instructions.md)、AI運用チェックリストはこの文書に集約する
- [ ] Firebase Rules、App Check、Auth、世帯参加/解除、認証解除、課金、暗号化などのセキュリティ/プライバシー影響がある変更は、人間レビュー必須にする
- [ ] AI/外部ツール利用時は、本番の家計明細・秘密情報・認証情報を渡さない運用ルールを明文化する
- [ ] GitHub IssueまたはPLAN用のタスクテンプレートを作り、背景、変更対象、完了条件、必須テスト、PLAN更新要否、プライバシー影響、ロールバック観点を毎回確認する
- [ ] Dependabot、secret scanning、依存関係レビュー、npm脆弱性チェック、EAS/Firebase/GitHub secrets棚卸しをApp Store申請前の確認項目に追加する
- [ ] Firebase CLI、EAS CLI、MCP、VS Code拡張、PDF/Web検索など外部ツールの権限・通信先・利用目的を棚卸しする
- [ ] 長いAI作業セッションで得た判断や再利用知見を、会話に閉じ込めず [PLAN.md](../PLAN.md)、repo memory、または専用ドキュメントへ退避する運用を続ける
- [ ] 開発成功指標として、家族2人での連続利用日数、クラッシュなし期間、同期遅延、Firestoreコスト、削除/解除フロー成功、CSV復旧可否を定義する
- [ ] 大きい実装や曖昧な依頼では、AIに着手させる前に目的、参照ファイル、制約、期待する出力形式、完了条件、実行すべき検証を明示する
- [ ] 仕様・設計・テスト観点を先にMarkdownへ残し、その文書をAI実装時のコンテキストにするスペック駆動の進め方を優先する
- [ ] 実装で分かった仕様差分は、コードだけでなく [PLAN.md](../PLAN.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)、ADR、チェックリストへ戻す
- [ ] 繰り返し使う作業手順（実装、レビュー、デバッグ、リリース確認、TestFlight検証）は、必要に応じて `.github/prompts/*.prompt.md` など再利用可能なプロンプト化を検討する
- [ ] プロンプト自体が重要成果物になる場合は、AIに曖昧さ、定義不足、矛盾、隠れた前提をレビューさせてから使う
- [ ] CopilotコードレビューやAIによる脆弱性検出は補助として使い、最終判断は人間レビュー、テスト、lint、型チェック、Rulesテスト、Dependabot/secret scanning/code scanningなどの決定的チェックと併用する
- [ ] Agent mode、Copilot CLI、Coding agentへ委任する場合は、Issue/タスク、変更範囲、禁止範囲、DoD、必須テスト、ドキュメント更新要否を明記してから実行する
