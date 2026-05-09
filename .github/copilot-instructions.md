# moneyplanner — GitHub Copilot ガイドライン

## プロジェクト概要

世帯向けiPhone家計簿アプリ（Expo SDK 54 / React Native）。
詳細は `PLAN.md` を参照。

## 技術スタック

- Expo SDK 54 / React Native 0.81.5
- expo-router v6
- Cloud Firestore（世帯単位のリアルタイム同期）
- Apple Sign-In + Firebase Auth
- React Native Firebase + expo-dev-client
- expo-file-system/legacy + expo-sharing（CSV出力）
- @react-native-community/datetimepicker

## DBについて

- Cloud Firestore に完全置換済み（`lib/firestore.ts`）
- Apple Sign-In + Firebase Auth で認証
- 世帯（household）単位でデータ分離
- リアルタイムリスナー（`onSnapshot`）で家族間同期
- 同一レコードの同時更新は `serverTimestamp()` による last-write-wins
- `lib/database.ts` / `expo-sqlite` は撤去済み。新規実装でSQLite APIを追加しないこと

## 開発サーバーについて

- React NativeアプリのためWeb向けpreviewは使用しない
- 動作確認はiPhoneのTestFlightまたはexpo-dev-clientビルドで行う
- React Native Firebaseのネイティブモジュールを使うため、Web/Expo GoではFirebase/Auth/App Checkの実動作確認をしない

## AIガイドラインの管理

- **両AIに共通する内容**（技術スタック・DB規則・Git規則・ファイル構成など）を変更するときは `CLAUDE.md` も同時に更新する
- **Copilot CLI / VS Code エージェントモード固有の内容**（スラッシュコマンド・ワークフローパターン・推奨モデルなど）はこのファイルのみ更新する

## AI運用チェックリスト（共通）

- 詳細ルールは `docs/ai-development.md` を参照し、実行時にも遵守する
- 大きい実装や委任前に、目的・変更範囲・禁止範囲・DoD・必須テストを明記する
- セキュリティ/プライバシー影響（Rules、Auth、課金、データ削除、暗号化など）がある変更は人間レビュー必須
- AI/外部ツールへ本番データ、秘密情報、認証情報、個人情報を渡さない
- 実装で判明した仕様差分は `PLAN.md`、`ARCHITECTURE.md`、`docs/ai-development.md` に反映する
- 重要な設計判断、方針転換、採用/不採用理由は `docs/decisions/` に記録し、将来の復活判断に必要な背景と復元方針も残す

## Gitについて

- `git push` はユーザーが明示的に指示したときのみ行う

## Copilot CLI と VS Code エージェントモードの使い分け

どちらも「AIエージェント」だが、得意な作業が異なる。

### Copilot CLI の2つの起動形態

| 形態               | コマンド           | 用途                            |
| ------------------ | ------------------ | ------------------------------- |
| インタラクティブ   | `copilot`          | 対話・計画・探索                |
| プログラマティック | `copilot -p "..."` | CI/CDスクリプト・ヘッドレス実行 |

### インタラクティブモードの3段階

| モード            | 切り替え                 | 説明                                   |
| ----------------- | ------------------------ | -------------------------------------- |
| 通常（会話+実行） | デフォルト               | AIと対話しながらコマンドを実行         |
| プランモード      | Shift+Tab または `/plan` | コーディング前に構造化された計画を作成 |
| オートパイロット  | Shift+Tab（実験的）      | 承認なしで自律的にタスク完了           |

### 主なスラッシュコマンド一覧

| コマンド    | 説明                                                             |
| ----------- | ---------------------------------------------------------------- |
| `/plan`     | コーディング前に構造化チェックリストを作成                       |
| `/research` | コードベース・GitHub・Webを横断調査、引用付きレポート生成        |
| `/review`   | ステージ済み/未ステージの変更をAIでコードレビュー                |
| `/delegate` | タスクをクラウドのCopilot Codingエージェントに非同期委譲         |
| `/diff`     | カレントディレクトリの変更差分をレビュー                         |
| `/fleet`    | タスクをサブエージェントで並列実行                               |
| `/agent`    | 専用カスタムエージェントを選択・起動                             |
| `/model`    | セッション中にモデルを切り替え（下記「タスク別推奨モデル」参照） |
| `/share`    | セッションや調査レポートを共有（例: `/share gist research`）     |
| `/mcp`      | MCPサーバー設定を管理                                            |
| `/context`  | トークン使用量を可視化                                           |
| `/compact`  | コンテキスト履歴を手動圧縮                                       |
| `/resume`   | 前回のセッションを再開                                           |
| `!COMMAND`  | AIをバイパスしてシェルコマンドを直接実行                         |

### タスク別推奨モデル（`/model` で切り替え）

| タスク                             | モデル                          |
| ---------------------------------- | ------------------------------- |
| アーキテクチャ設計・複雑なバグ解析 | Claude Opus 4.6                 |
| 日常的な機能開発・コード編集       | Claude Sonnet 4.6（デフォルト） |
| コード生成・レビュー特化           | GPT-5.3 Codex                   |

### Copilot CLI（`copilot` コマンド）が向いている場面

- **GitHub.com操作**: PR作成・マージ、Issue作成・管理、ブランチ操作（GitHub MCPサーバーが内蔵）
- **一気通貫フロー**: ブランチ作成 → 実装 → PR作成 を1セッションで流す
- **コードレビュー**: `/review` でブランチの変更を即座にレビュー
- **深い技術調査**: `/research` でコードベース・GitHub・Webを横断調査
- **シェル自動化**: `-p` オプションでCI/CDへの組み込みやヘッドレス実行
- **大規模リファクタ**: `/plan` + オートパイロットで体系的に進める

### VS Code エージェントモードが向いている場面

- **差分プレビューつきのコード編集**: 変更前に正確なファイル差分を確認
- **複数ファイル横断の変更**: エディタ上で変更箇所をリアルタイム確認
- **LSP/診断情報を活かしたデバッグ**: エラーや警告が直接コンテキストに入る
- **対話的な実装**: 途中で方針を変えながら進めたい作業
- **ビジュアルデバッガとの連携**: エディタのブレークポイントを使うデバッグ

### Copilot CLI の `/research` コマンド

技術調査に特化したスラッシュコマンド。コードベース・GitHub上のリポジトリ・Webを横断して調査し、引用付きMarkdownレポートを生成する。

- **向いている用途**: 新技術の導入前調査、ライブラリ比較、アーキテクチャ全体の把握
- **向いていない用途**: コード変更（レポート生成のみでファイル編集はしない）、簡単な質問
- **共有**: `/share gist research` でGitHub Gistとして保存・共有可能

```
# moneyplanner向け使用例
/research How does expo-camera integrate with Claude Vision API for receipt OCR?
/research Best practices for iCloud Drive file sync in React Native / Expo
/research Comparing expo-sqlite v16 openDatabaseSync vs WAL mode performance
/research EAS Build configuration for App Store submission with Expo SDK 54
```

### moneyplanner での推奨ワークフローパターン

**パターン1: 機能開発（推奨）**

```
Phase 1: RESEARCH  → Copilot CLI /research
Phase 2: PLAN      → Copilot CLI /plan（Shift+Tab）
Phase 3: IMPLEMENT → VS Code エージェントモード（差分レビューしながら）
Phase 4: TEST      → 開発者がTestFlightまたはdev-clientで確認
Phase 5: COMMIT/PR → Copilot CLI
```

**パターン2: バグ修正**

```
Phase 1: DIAGNOSE → VS Code エージェントモード（LSP診断情報活用）
Phase 2: FIX      → VS Code エージェントモード
Phase 3: VERIFY   → 開発者がTestFlightまたはdev-clientで確認
Phase 4: COMMIT   → Copilot CLI または VS Code エージェントモード
```

**パターン3: GitHub操作のみ**

```
→ Copilot CLI 一択
"未解決のIssue一覧を見せて"
"PR #12 にバグがないかチェックして"
"チェックが通ったらPR #12 をマージして"
```

**パターン4: 大規模リファクタ**

```
Phase 1: /plan   → Copilot CLI プランモード
Phase 2: EXECUTE → Copilot CLI オートパイロット（実験的）または VS Code エージェントモード
Phase 3: /review → Copilot CLI で main に対してレビュー
Phase 4: PR      → Copilot CLI
```

### 判断の目安

- GitHub.com を操作したい → **Copilot CLI**
- 技術調査・事前リサーチをしたい → **Copilot CLI `/research`**
- ファイルを編集・実装したい → **VS Code エージェントモード**
- コードレビューしたい → **Copilot CLI `/review`**
- 実装してからPR作成 → 実装は**VS Code エージェントモード**、PR作成は**Copilot CLI**
- 大規模タスクを計画したい → **Copilot CLI `/plan`**

## ファイル構成

```
lib/
  firestore.ts     # Firestore CRUD
  auth.ts          # 認証ロジック
  household.ts     # 世帯管理
  csvExport.ts     # CSV生成・共有（expo-file-system/legacyを使用）
app/
  auth.tsx         # ログイン画面
  household.tsx    # 世帯作成/参加画面
app/(tabs)/
  index.tsx        # 記録タブ（初期画面）
  history.tsx      # 履歴タブ
  summary.tsx      # 集計タブ
  settings.tsx     # 設定タブ
```
