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

## 更新履歴

### 2026-05-08: SDK 54 互換範囲の更新を適用

- `npm update` で `Wanted` 列の更新を一括適用
- 主な更新: `expo` 54.0.33→54.0.34、`expo-dev-client` 6.0.20→6.0.21、`expo-file-system` 19.0.21→19.0.22、`firebase` 12.12.1→12.13.0、`firebase-tools` 15.15.0→15.17.0、`react-native-worklets` 0.5.1→0.5.2、`@babel/core` 7.28→7.29、`@react-navigation/*` マイナー更新ほか
- 脆弱性: **12件 → 5件**（high 5 → 0、moderate 7 → 5）
- 残5件はすべて `postcss → @expo/metro-config → @expo/cli → expo` のビルド時依存チェーン。`npm audit fix --force` は expo@49 へのダウングレードを提案するため非適用。iOS実機ランタイムには到達しないため、SDK 55 移行時に再評価
- テスト: 全141件パス、回帰なし
- 型チェック: 既存の pre-existing TS エラー5件（B2/B4/C3 などの直近修正で混入）を同タイミングで修正
  - `lib/firestore.ts` の `BatchOp` map に明示的な型注釈を付与
  - `updateAccountBalance` を `tx.get(Query)` 非対応問題のため、取引読み取りをトランザクション外へ移動（B4の主要意図は維持）
  - `buildBudgetStatusesFromData` に `fromCache?: boolean` 入力を追加し、`summary.tsx` と `lib/firestore.ts:1700` 系の呼び出しから渡すよう更新
  - `HistorySearchPreviewTransaction.type` を `"income" | "expense"` に絞り込み、`SearchableTransaction` との互換性を確保
- EAS再ビルド: `expo-dev-client` などネイティブ依存が更新されたため、次のbuild（22以降）から反映

### 次回更新時の確認事項

- Expo SDK 55 移行は React Native 0.85 を伴うため、別チケットで段階検証
- `node-forge` / `@xmldom/xmldom` の高重大度指摘は今回の更新で解消済み
