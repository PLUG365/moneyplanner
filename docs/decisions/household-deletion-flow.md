# 世帯削除フローの恒久方針（2026-07-02）

## 背景

「認証解除と全データ削除」および最後のメンバー退出時の世帯削除は、クライアント側で
`households/{householdId}` 配下の既知サブコレクション（`lib/accountDeletion.ts` の
`HOUSEHOLD_DELETION_COLLECTION_NAMES` + `joinRequests`）と `inviteCodes` を
499件単位のバッチで削除したあと、世帯ドキュメント本体を削除する実装になっている
（`lib/household.ts` / `lib/firestore.ts`）。

この方式には以下の構造的な制約がある。

- バッチ間はアトミックではないため、途中失敗すると部分削除状態で停止する
- 削除対象のサブコレクション名はクライアントの静的リストに依存し、新コレクション追加時に更新漏れのリスクがある
- 削除実行者の端末がオフライン・強制終了した場合、残骸データが世帯配下に残り得る

## 決定

- **クライアント主導の削除フローを恒久方針として維持する**（Cloud Functions への寄せ替えは行わない）
- 部分削除状態への安全弁は Firestore Security Rules 側で担保する
  - 削除順序は「サブコレクション → 世帯ドキュメント本体」を維持し、`members` はサブコレクション削除の最後に削除する（`lib/accountDeletion.ts` のリスト順で保証。削除途中でも activeMember 判定が生きる）
  - 世帯ドキュメント本体が削除された時点で、`activeMember()` の `exists(households/{id})` チェックにより残骸サブコレクションへの読み書きは全て拒否される（`firestore.rules.test.ts` の負のテストで検証済み）
  - 残骸データは第三者から読み取り不能なため、プライバシー上の実害は限定的
- 新しいサブコレクションを追加する際は、`lib/accountDeletion.ts` の
  `HOUSEHOLD_DELETION_COLLECTION_NAMES` への追加を必須手順とし、
  `lib/accountDeletion.test.ts` で `members` が末尾であることを検証し続ける

## 理由

- 家計簿アプリの世帯データ規模（数千〜数万件）では、クライアントのバッチ削除で実用上十分
- Cloud Functions 導入はコスト・運用・デプロイ管理の複雑さが増え、現行の「Cloud Functionsは必要になるまで見送り」方針（PLAN.md Phase 3 除外スコープ）と整合しない
- Rules の `exists(households/{id})` ガードにより、部分削除状態でもアクセス遮断は即時に成立する

## 代替案と再検討条件

- 代替案: Cloud Functions（`onDocumentDeleted` トリガーまたは callable）で
  再帰削除（`firebase-tools` の recursive delete 相当）を行い、残骸を非同期に掃除する
- 以下のいずれかが発生した場合は Cloud Functions 化を再検討する
  - 部分削除の残骸が原因のユーザー問い合わせ・課金増が実際に発生した
  - サブコレクション数が増え、静的リスト管理の更新漏れが現実の障害になった
  - 他の理由（レート制限、通知など）で Cloud Functions を導入済みになった
