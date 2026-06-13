# 口座残高は手動＋増分のみ（自動 reconcile 廃止）／履歴はページング化（2026-06-14）

## 背景

Zaim から約11,500件の過去取引をCSVインポートしたことで、以下の問題が顕在化した。

1. **履歴タブのフリーズ/クラッシュ**: 履歴リストが全取引を無制限購読（`orderBy("date","desc")`、limitなし）し、
   `ScrollView` + `transactions.map()` で**非仮想化の全件描画**をしていた。1万件超でJSスレッドが固まり、
   リロード時に `TurboModuleManager: Timed out waiting for modules to be invalidated` でクラッシュ。
   同画面の全件購読に巻き込まれ、カレンダー表示も空になった。

2. **口座操作が毎回重い**: `reconcileAccountBalancesFromTransactions` が口座ピッカー/口座管理を開くたびに
   **全取引を `.get()`** して残高を再計算していた（記録タブ・履歴編集・設定の口座管理の各オープン時）。

3. **残高モデルの矛盾**: 残高は「初期残高 + 全取引の純額」で reconcile が再計算・上書きする設計だった。
   インポートは残高を増分しないが、reconcile が走るとインポート分（未紐付け/空口座は既定口座「家計」へ合算）が
   残高に折り込まれ、現在残高が大きく変わってしまう。

## 決定

- **インポートした過去取引は口座残高に含めない**（記録・集計用と割り切る）。
- 口座残高は本来の「**手動設定（`updateAccountBalance`）＋ 記録/編集/削除時の増分（`FieldValue.increment`）**」のみで維持する。
- **全取引からの自動 reconcile を廃止**する。これにより「インポート分が残高へ折り込まれる」問題と
  「毎回全件読みで遅い」問題が同時に解消する。
- **履歴リストをカーソルページング＋仮想化**にして大量データに耐えるようにする。

## 実装

### 残高（自動 reconcile 廃止）
- `reconcileAccountBalancesFromTransactions` の自動呼び出しを全削除:
  - `app/(tabs)/index.tsx`（記録タブの口座ピッカー `onAccountPickerOpen`）
  - `app/(tabs)/history.tsx`（編集モーダル開始 / 編集口座ピッカー開く）
  - `app/(tabs)/settings.tsx`（口座管理オープン）
- 関数 `reconcileAccountBalancesFromTransactions`（`lib/firestore.ts`）自体は残すが**どこからも自動呼び出ししない**。
  将来「手動再計算（インポート除外）」ボタンを足す余地として温存。
- `updateAccountBalance`（手動設定）は balance=入力値で確定。自動 reconcile が無いため値は保持される。
  以前は initialBalance を逆算するために全取引を読んでいたが、reconcile 廃止で不要になったため**全取引読み込みを撤去**し、
  `balance` と `initialBalance` を入力値で直接保存する（即座に完了）。
- 口座名変更（`updateAccountName`）は全取引のスナップショット名を書き換えるため重い。`handleSaveAccount` では
  **名前が変わっていない（残高のみ変更）場合は `updateAccountName` をスキップ**し、無駄な全件書き換えを避ける。
  名前変更を伴う保存時のみ重くなるため、設定画面は共通の `ProgressOverlay`（件数不明モード）で「保存中…」を表示する。
- ⚠️ 既知の限界: インポート取引を後からアプリ内で**編集**すると `updateTransaction` の増分が効いて残高がわずかにずれ得る
  （履歴は基本閲覧用のため許容。ずれたら口座管理で手動再設定して補正）。

### 履歴リスト（ページング＋仮想化）
- 新フック `hooks/usePaginatedTransactions.ts`: 日付降順 `limit(100)` の `.get()` で初回取得、
  `startAfter(最後のdoc).limit(100)` で追加取得（カーソルページング）。日付範囲指定時は `where("date", ...)` を付与
  （date 単一フィールドのため複合インデックス不要）。リアルタイム購読ではないため、画面フォーカス時・
  取引のミューテーション後（削除/編集/一括コピー）に `refresh()` で先頭ページを取り直す。
- `app/(tabs)/history.tsx`: 全件購読を上記フックに置換。リスト描画を `ScrollView` + `.map()` から
  **`FlatList`**（`onEndReached` で追加読み込み、`ListFooterComponent` にスピナー、`RefreshControl` でプルリフレッシュ、
  初回ロードは `ActivityIndicator`）へ変更。カレンダー表示は従来の月スコープ購読のまま。
- 種別/カテゴリ/内訳/店舗/メモの絞り込みは読み込み済みページに対するクライアント側フィルタのまま（既知の制限）。

## 既存データの是正（運用手順）
- 改修反映前に口座管理を開いたことで、既定口座「家計」の残高が reconcile によりインポート分を含む値に
  変わっている可能性が高い。改修反映後に**口座管理で家計の残高を実際の現在額へ手動設定し直す**（一度きり）。

## 復元方針（将来戻す場合）
- 自動再計算を復活させる場合は、インポート取引を残高計算から除外する仕組み（例: 取引に `excludeFromBalance` フラグ、
  reconcile/increment 側で除外）を併せて入れること。フラグ無しで reconcile を復活させるとインポート分が再び折り込まれる。
- 履歴のリアルタイム性が必要なら、先頭ページのみ `onSnapshot`（limit付き）＋以降を `.get()` ページングにする案がある
  （ライブ境界とカーソルの整合に注意）。
