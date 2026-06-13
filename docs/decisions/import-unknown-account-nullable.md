# インポート時の未知口座を accountId=null（表示名のみ保持）にする（2026-06-13）

## 背景

CSV インポート（Zaim 等の外部家計簿）で、CSV の口座名がアプリの口座マスタに存在しない場合、
従来は `accountId` が既定口座「家計」の ID にフォールバックし、`accountNameSnapshot` には
元の口座名（例「家計広島銀行」）が残っていた。結果、**「accountId は家計なのに表示名は別物」**
という不整合な取引が生成されていた。さらにこの状態は脆く、当該取引を編集すると編集ピッカーが
既定口座を選択し、保存時に表示名が既定口座名へ上書きされて消える
（`app/(tabs)/history.tsx` の編集初期化ロジック）。

`categoryId` / `breakdownId` / `storeId` はいずれも `string | null` で、マスタ非一致時は
`null`（無紐付け）＋名前スナップショット保持という扱いだった。`accountId` だけが非nullable
（`string`）で、唯一フォールバック挙動になっていた。

## 決定

口座を他のマスタFK（カテゴリ/内訳/店舗）と同じ扱いに揃える。インポート解決を3分岐にする。

- 口座名が**空** → `defaultAccountId`（既存「家計」に紐づく。Zaim 口座情報なしの行）
- 口座名が**マスタと一致** → そのID
- 口座名**あり・不一致** → **`accountId = null`**（表示名スナップショットのみ保持、既定口座へ偽紐付けしない）

これにより `Transaction.accountId` を `string | null` 化した。

## 実装詳細

- `lib/csvImportResolve.ts`: `ResolvedImportRow.accountId` を nullable 化し、解決を3分岐化。
- `lib/firestore.ts`: `Transaction.accountId` / `ImportTransactionRow.accountId` を nullable 化。
  `mapTransaction` の読み出しを `data.accountId ?? DEFAULT_ACCOUNT_ID` → `?? null` に変更。
- `lib/transactionCopy.ts`: `CopySource.accountId` を nullable 化（コピー時は従来どおり
  名前一致 or 既定へフォールバックし `accountFallback` を通知）。

## 残高再計算を変更しなかった理由

`reconcileAccountBalancesFromTransactions`（`lib/firestore.ts`）は Firestore 生データを直接読み
`data.accountId ?? DEFAULT_ACCOUNT_ID` で null を既定に寄せて集計する。ロジック本体
`lib/accountBalanceReconciliation.ts` の `transaction.accountId || defaultAccountId` も同様で、
テスト「treats missing transaction account as default」で**意図的挙動として固定**されている。

今回の要望は「ID/表示名の不整合解消」であって残高仕様の変更ではない。残高側まで
「null は残高に含めない」へ変えると、テスト済みの意図的挙動を壊し変更範囲も広がるため、
**残高ロジックは現状維持**とした（null 口座取引は残高計算上は既定口座に合算され続ける）。

## 影響と非対象

- Firestore Rules は変更不要（サブコレクションはフィールド型検証なし `allow read, write: if activeMember`）。
- 記録タブ（`app/(tabs)/index.tsx`）の新規取引「口座必須」バリデーションは維持。null は
  インポートで未知口座だった場合のみ発生し、手入力では許さない。
- 既存データのマイグレーションはしない（過去取引の accountId は据え置き）。
- CSV 変換スクリプト（`参考資料/` 配下のローカルスクリプト。`参考資料` は `.gitignore` 済みで
  git 管理外）・出力 CSV は変更不要。口座名入りのまま取り込めば未知口座は accountId=null + 表示名で入る。

## 復元方針（将来 accountId 非null へ戻す場合）

- 集計・検索を口座IDベースで行う機能を追加する場合は、(1) インポート前に口座マスタを同名で
  用意して名前一致させる運用に寄せるか、(2) 解決の不一致分岐を `null` から
  `defaultAccountId` フォールバックへ戻す（本コミットの逆操作）。
- その際は `Transaction.accountId` を `string` に戻し、`mapTransaction` の `?? null` を
  `?? DEFAULT_ACCOUNT_ID` に戻す。残高ロジックは本変更で触れていないため戻し不要。
