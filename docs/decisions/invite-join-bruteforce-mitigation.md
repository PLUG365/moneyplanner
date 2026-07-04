# 招待コード参加の総当たり対策方針（2026-05-10）

## 背景

招待コード参加は6文字コードの入力を前提とし、`/inviteCodes/{code}` の `get` を利用している。
本番運用では総当たり試行の抑止が必要だが、現時点では Cloud Functions 未導入でクライアント主導の参加処理である。

> 追記（2026-07-02）: 招待コードの新規発行は `expo-crypto`（CSPRNG）による10文字生成へ変更した。
> 旧6文字コードは有効期限内に限り参加に使用できる（`lib/inviteCode.ts`）。
> 総当たり空間は 32^6 ≒ 10^9 から 32^10 ≒ 10^15 へ拡大し、Math.random による予測可能性も解消した。

> 追記（2026-07-04）: `/inviteCodes` の一覧取得（list）は全面禁止としていたが、
> 世帯退出・全データ削除時のクリーンアップ（`householdId` 一致検索での自世帯コード削除）が
> permission-denied になる不具合（build 26 発見事項 #2）が判明したため、
> **自世帯のコードに限り list を許可**する形へ緩和した
> （`allow list: if signedIn() && activeMember(resource.data.householdId)`）。
> activeMember は members サブコレクション（本人が偽造できない）を根拠とするため、
> 自分の `users.householdId` を書き換えた非メンバーには一覧できず、総当たり耐性は維持される。
> Rulesテストで「自世帯はlist可 / 偽造users docではlist不可 / 無条件listは不可」を検証済み。

## 決定

- `/inviteCodes/{code}` の直接 `get` 方式は現行維持とする
- クライアント実装として、`/users/{uid}` に失敗回数とクールダウン情報を保持する
- `requestJoinHousehold` で以下を実装する
  - 失敗回数がしきい値に達したら10分クールダウン
  - クールダウン中は参加試行を即拒否
  - 参加リクエスト作成成功時に失敗回数をリセット
- Firestore Rules 側では、joinRequests作成時に有効な招待コード（`expiresAt` 未到来かつ `disabledAt` 未設定）を要求する

## 実装詳細

- 失敗回数しきい値: 5回
- クールダウン時間: 10分
- 保存先: `/users/{uid}`
  - `inviteJoinFailedAttempts: number`
  - `inviteJoinCooldownUntil: Timestamp`
  - `inviteJoinLastFailedAt: Timestamp`

## セキュリティ上の整理

- この対策はUX面の抑止として有効だが、クライアント経由ロジックのため強制力は限定的
- 本格的なレート制限は Cloud Functions または別のサーバーサイド経路での実施が前提
- App Check enforcement は bot/不正クライアント抑止の補助として有効であり、TestFlight確認後に有効化判断する

## 代替案と保留事項

- 代替案: 参加処理を Cloud Functions に寄せ、IP/uid単位のレート制限と監査ログを集約
- 今回は既存リリース準備のスコープを優先し、クライアント+Rulesで先行実装しつつ、直接 get 方式を継続する
- Cloud Functions への寄せ替えは将来の再検討事項とする
