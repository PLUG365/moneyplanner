# 取引のソフトデリート採用（2026-07-04）

## 背景

issue #4「検索の網羅性」の対応で、検索を「ローカルキャッシュ全件 + `updatedAt` 差分同期」方式へ
移行することにした（大量データでもFirestore読み取りを増やさないため）。このとき物理削除には
2つの問題がある。

1. `updatedAt > 前回同期時刻` の差分クエリでは**削除されたドキュメントを検知できない**
   （消えたものはクエリ結果に現れない）
2. 一回きりの `get()` はサーバーで消えたドキュメントをSDKローカルキャッシュから確実に
   除去しないため、**キャッシュに幽霊データが残る**

## 決定

- 取引の削除（`deleteTransaction` / `deleteTransactionFromPrevious`）は物理削除ではなく
  **`deleted: true` + `updatedAt: serverTimestamp()` の更新**で表現する（ソフトデリート）
- 削除も「更新の一種」になるため、差分クエリ1本で新規・編集・削除をすべて拾える
- 口座残高の戻し（`buildBalanceAdjustmentsForDelete`）は従来どおり削除時に実行する
- 読み側の除外は `lib/transactionSoftDelete.ts` の判定に一元化し、
  `mapActiveTransactions()`（lib/firestore.ts）経由で履歴・検索・集計・カレンダー・
  CSVエクスポート・残高計算のすべてに適用する
- **世帯の全データ削除・最後の1人退出は従来どおり物理削除**（世帯ごと消すため差分同期の考慮が不要）
- Security Rules の変更は不要（transactions は包括ルールで update 可）

## 整合性ガード

- `deleteTransaction`（transaction版）: 削除済みドキュメントへの再削除は**残高を二重に戻さない**よう
  読み取りガードでスキップ
- `updateTransaction`: 削除済み取引の編集はエラーにする（残高は戻し済みで、編集の差分計算が
  二重適用になり残高が壊れるため）
- `deleteTransactionFromPrevious` / `updateTransactionFromPrevious`（オフライン用・読み取りなしバッチ）は
  ガードできない。複数端末の同時操作は従来から last-write-wins 方針であり、許容する

## 影響・トレードオフ

- 削除済みドキュメントがストレージに残る（家計簿の削除頻度なら容量影響は無視できる）
- 読み側で `deleted` 除外を通し忘れると削除済みが表示される → `mapActiveTransactions` への
  一元化と `lib/transactionSoftDelete.test.ts` で防ぐ
- 既存データへのマイグレーションは不要（`deleted` フィールドがない = 未削除）

## 代替案（不採用）

- **物理削除 + tombstoneコレクション**: 削除記録を別コレクションに書く。二重書き込みと
  読み合わせの複雑さが増すだけで利点がない
- **物理削除 + 定期フル再同期**: 幽霊データを許容し、たまに全件読み直す。Firestore読み取り
  削減という本来の目的と矛盾する
