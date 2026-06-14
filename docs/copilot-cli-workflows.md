# Copilot CLI / VS Code エージェント運用メモ

この文書は `.github/copilot-instructions.md` から参照する補助資料です。常時読み込ませる指示ではなく、GitHub操作・調査・大規模計画などで必要なときに参照します。

## Copilot CLI の起動形態

| 形態 | コマンド | 用途 |
| --- | --- | --- |
| インタラクティブ | `copilot` | 対話・計画・探索 |
| プログラマティック | `copilot -p "..."` | CI/CDスクリプト・ヘッドレス実行 |

## インタラクティブモード

| モード | 切り替え | 説明 |
| --- | --- | --- |
| 通常（会話+実行） | デフォルト | AIと対話しながらコマンドを実行 |
| プランモード | Shift+Tab または `/plan` | コーディング前に構造化された計画を作成 |
| オートパイロット | Shift+Tab（実験的） | 承認なしで自律的にタスク完了 |

## 主なスラッシュコマンド

| コマンド | 説明 |
| --- | --- |
| `/plan` | コーディング前に構造化チェックリストを作成 |
| `/research` | コードベース・GitHub・Webを横断調査し、引用付きレポートを生成 |
| `/review` | ステージ済み/未ステージの変更をAIでコードレビュー |
| `/delegate` | タスクをクラウドのCopilot Codingエージェントに非同期委譲 |
| `/diff` | カレントディレクトリの変更差分をレビュー |
| `/fleet` | タスクをサブエージェントで並列実行 |
| `/agent` | 専用カスタムエージェントを選択・起動 |
| `/model` | セッション中にモデルを切り替え |
| `/share` | セッションや調査レポートを共有 |
| `/mcp` | MCPサーバー設定を管理 |
| `/context` | トークン使用量を可視化 |
| `/compact` | コンテキスト履歴を手動圧縮 |
| `/resume` | 前回のセッションを再開 |
| `!COMMAND` | AIをバイパスしてシェルコマンドを直接実行 |

## タスク別推奨モデル

| タスク | モデル |
| --- | --- |
| アーキテクチャ設計・複雑なバグ解析 | Claude Opus 4.6 |
| 日常的な機能開発・コード編集 | Claude Sonnet 4.6（デフォルト） |
| コード生成・レビュー特化 | GPT-5.3 Codex |

## 使い分け

- GitHub.com操作、PR作成、Issue整理、ブランチ操作: Copilot CLI
- 技術調査、導入前リサーチ、Web/GitHub横断調査: Copilot CLI `/research`
- ファイル編集、実装、差分確認、LSP診断を使うデバッグ: VS Code エージェントモード
- コードレビュー: Copilot CLI `/review`
- 大規模タスクの計画: Copilot CLI `/plan`

## moneyplanner 推奨ワークフロー

### 機能開発

```text
Phase 1: RESEARCH  -> Copilot CLI /research
Phase 2: PLAN      -> Copilot CLI /plan
Phase 3: IMPLEMENT -> VS Code エージェントモード
Phase 4: TEST      -> TestFlight または dev-client で確認
Phase 5: COMMIT/PR -> Copilot CLI
```

### バグ修正

```text
Phase 1: DIAGNOSE -> VS Code エージェントモード
Phase 2: FIX      -> VS Code エージェントモード
Phase 3: VERIFY   -> TestFlight または dev-client で確認
Phase 4: COMMIT   -> Copilot CLI または VS Code エージェントモード
```

### GitHub操作のみ

```text
Copilot CLI を使う。
例: Issue一覧、PRレビュー、チェック通過後のマージ。
```

### 大規模リファクタ

```text
Phase 1: /plan   -> Copilot CLI プランモード
Phase 2: EXECUTE -> Copilot CLI オートパイロットまたは VS Code エージェントモード
Phase 3: /review -> Copilot CLI で main に対してレビュー
Phase 4: PR      -> Copilot CLI
```

## `/research` 例

```text
/research Firestore read/write cost optimization patterns for household budget apps
/research Firebase App Check enforcement migration strategy with phased rollout in production
/research Expo SDK 55 migration checklist for React Native Firebase apps (54 -> 55)
/research App Store submission requirements for finance apps with shared household data
```
