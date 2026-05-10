# 依存ライブラリ監査メモ（2026-05-10）

## 目的

App Store配布前の品質ゲートとして、依存ライブラリの実在、更新状況、ライセンス、脆弱性、lockfile固定を確認する。

## 実行コマンド

```powershell
npm ls --depth=0
npm outdated --long
npm audit --omit=dev --audit-level=high
npx license-checker --production --summary
git ls-files package-lock.json
```

## 確認結果

### 1. 実在確認

- `npm ls --depth=0` でトップレベル依存が解決されることを確認。
- React Native Firebase、Expo SDK 54 系依存がインストール済み。

### 2. メンテ状況（更新余地）

- `npm outdated --long` で更新候補を確認。
- 主要依存は `Current` と `Wanted` の差分が小さいものが多い。
- `Latest` は Expo SDK 55 / React Native新系列を含むため、即時更新は別チケットで段階検証が必要。

### 3. ライセンス概要（production）

- `npx license-checker --production --summary` 実行結果:
  - MIT: 592
  - Apache-2.0: 69
  - ISC: 42
  - BSD-3-Clause: 28
  - BlueOak-1.0.0: 8
  - BSD-2-Clause: 8
  - その他少数
  - UNLICENSED: 1（アプリ本体パッケージ）

### 4. 脆弱性（production監査）

- `npm audit --omit=dev --audit-level=high` で high/moderate を検出。
- 主な指摘は transitive dependency（`expo` / `@expo/metro-config` 周辺を含む）。
- `npm audit fix --force` は Expoメジャーダウングレードを伴う提案が含まれ、現行SDKを壊す可能性が高いため未適用。

### 5. lockfile固定

- `package-lock.json` の存在を確認。
- `git ls-files package-lock.json` で Git 管理下であることを確認。

## 判断

- 「依存ライブラリの実在、メンテ状況、ライセンス、脆弱性、lockfile固定を確認する」は実施済み。
- ただし脆弱性の自動修正は破壊的変更を伴う可能性があるため、別途「Expo SDK整合を崩さない更新計画」で対応する。

## 次アクション

1. Expo SDK 54 の互換範囲で `Wanted` 更新を優先適用する小規模アップデートを検討。
2. `npm audit` の high 指摘について、到達可能性（runtime到達/開発時のみ）を切り分ける。
3. Expo SDK 55 へ上げるタイミングで監査を再実行し、未解消項目を再評価する。
