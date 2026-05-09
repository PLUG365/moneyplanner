# AI活用・開発運用

AI活用、外部ツール、レビュー、知見退避ルールをまとめる文書です。

`GitHub Copilotのススメ` と `GitHub Copilot プロンプトリファレンス [2026年1月版]` の知見を踏まえ、AIに実装を任せる範囲が広がっても、目的・完了条件・検証・権限範囲を明文化して安全に進める。

## 運用ルール（常時適用）

- ドキュメントのSSOTを明確化する。進捗は [PLAN.md](../PLAN.md)、構成/データモデルは [ARCHITECTURE.md](../ARCHITECTURE.md)、リポジトリ固有のAI実行ルールは [CLAUDE.md](../CLAUDE.md) / [.github/copilot-instructions.md](../.github/copilot-instructions.md)、AI運用チェックリストはこの文書を正とする。内容が矛盾した場合は、実行ルールとして [CLAUDE.md](../CLAUDE.md) / [.github/copilot-instructions.md](../.github/copilot-instructions.md) を優先し、この文書を同期更新する。
- Firebase Rules、App Check、Auth、世帯参加/解除、認証解除、課金、暗号化などのセキュリティ/プライバシー影響がある変更は人間レビューを必須とする。
- AI/外部ツール利用時は、本番の家計明細・秘密情報・認証情報を渡さない。
- 大きい実装や曖昧な依頼では、AI着手前に目的、参照ファイル、制約、期待する出力形式、完了条件、実行すべき検証を明示する。
- 仕様・設計・テスト観点を先にMarkdownへ残し、その文書をAI実装時のコンテキストにする。
- 実装で分かった仕様差分は、コードだけでなく [PLAN.md](../PLAN.md)、[ARCHITECTURE.md](../ARCHITECTURE.md)、ADR、チェックリストへ戻す。
- 重要な設計判断、方針転換、採用/不採用理由は [docs/decisions/](decisions/README.md) に記録し、将来の復活判断に必要な背景と復元方針も残す。
- 長いAI作業セッションで得た判断や再利用知見を、会話に閉じ込めず [PLAN.md](../PLAN.md)、repo memory、または専用ドキュメントへ退避する。
- CopilotコードレビューやAIによる脆弱性検出は補助として使い、最終判断は人間レビュー、テスト、lint、型チェック、Rulesテスト、Dependabot/secret scanning/code scanningなどの決定的チェックと併用する。
- Agent mode、Copilot CLI、Coding agentへ委任する場合は、Issue/タスク、変更範囲、禁止範囲、DoD、必須テスト、ドキュメント更新要否を明記してから実行する。
- 繰り返し使う作業手順（実装、レビュー、デバッグ、リリース確認、TestFlight検証）は、必要に応じて `.github/prompts/*.prompt.md` など再利用可能なプロンプトとして整備する。
- 各リリース判定ゲートについて、必須テスト、実機確認、ドキュメント更新、ユーザー確認項目、未解決リスクのチェックリストを定義し、運用時に更新する。
- プロンプト自体が重要成果物になる場合は、AIに曖昧さ、定義不足、矛盾、隠れた前提をレビューさせてから使う
