# リリースチェックリスト

TestFlight、App Check enforcement、App Store申請、有料化開始前の確認項目をまとめる文書です。

## Phase 3 検証項目

1. EAS Build で開発ビルドが iOS に正常インストールされること
2. Apple Sign-In でログインし、`/users/{uid}` ドキュメントが作成されること
3. 世帯作成 → 招待コード生成 → 別アカウントで参加リクエストを送信し、既存メンバー承認後に参加できること（現行フローは参加承認制）
4. 記録タブで収支登録 → 別端末でリアルタイムに反映されること
5. 同一レコードを2端末から更新 → 最後の書き込みが両端末に反映されること（last-write-wins）
6. オフラインで記録 → オンライン復帰時に自動同期されること
7. 集計タブの数値が Firestore データと一致すること
8. CSV出力が Firestore データから正しく生成されること
9. 設定画面から認証解除すると、現在のユーザーの認証情報と世帯配下のFirestoreデータが削除されること
10. 世帯データ削除後、他メンバーが起動すると世帯作成/参加画面へ戻ること
11. 設定画面からメンバー解除すると、解除されたメンバーが次回アクセス時に世帯データへアクセスできなくなること
12. 既存SQLiteデータを移行せず破棄しても、Firestore上で全機能が新規データとして動作すること

## ユーザー確認項目

- [x] TestFlightまたはdev-clientでApple Sign-Inが通り、ログイン後に世帯作成/参加画面へ遷移すること（build 14で確認）
- [x] 2つのApple IDで世帯作成 → 招待コード参加 → 記録タブの追加内容が別端末の履歴タブへリアルタイム反映されること（build 14で確認。当時の即参加フローで確認）
- [x] 招待コード入力後に参加リクエストが作成され、既存メンバーが設定画面で承認すると参加端末が世帯所属になること（build 24で確認）
- [ ] 承認待ち画面で参加リクエストをキャンセルでき、既存メンバー端末の参加リクエスト一覧からも消えること（build 24で確認）
- [x] メンバー解除後、解除された側が次回起動時に世帯データへアクセスできず、世帯作成/参加画面へ戻ること（2026-05-10 dev-client確認）
- [x] 「認証解除と全データ削除」でCSV出力の必要性を確認したうえで、確認入力・Apple再認証・Authアカウント削除・Firestore世帯データ削除が完了すること
- [ ] 世帯データ削除後、他メンバーのAuthアカウントは残りつつ、次回起動時に世帯未所属として扱われること
- [x] Java 21以上のJDKを導入し、`npm run test:rules` でFirestore Rulesテストを実行する
- [x] Firestore EmulatorでSecurity Rulesを確認し、自世帯以外・解除済みメンバー・削除済み世帯への読み書きが拒否されること
- [x] Firebase ConsoleでApp Checkを登録し、FirestoreのApp Check enforcement有効化前にdev-client/TestFlightでトークン取得を確認すること（2026-05-10: iOSアプリ登録済み、DeviceCheck/App Attest有効。App Check指標で確認済みリクエスト 91/91, 100% を確認）
- [ ] Firebase ConsoleでFirestoreのApp Check enforcementを有効化する（有効化前にApp Check指標の確認済みリクエスト比率が継続して100%であることを再確認する）
- [ ] App Check enforcement有効化後、dev-client/TestFlightでログイン・記録・履歴・集計・設定の主要導線が permission-denied にならず動作することを確認する
- [ ] App Check enforcement有効化後、Firebase ConsoleのApp Check指標で未確認リクエストの拒否が想定どおり発生していることを確認する（正規クライアントの拒否が発生した場合は enforcement を一時解除して原因を切り分ける）
- [x] App Store申請前にプライバシーポリシー、招待コード再発行/無効化の要否を最終判断すること（2026-05-10: `docs/privacy-policy.md` 作成、招待コード方針は現行維持で確定）

## TestFlightビルド発行手順

React Native Firebaseの実動作確認はExpo GoやWebでは行わず、TestFlightまたはexpo-dev-clientで確認する。

### 事前確認

1. 変更内容に応じて [PLAN.md](../PLAN.md) と [docs/testflight-history.md](testflight-history.md) の更新要否を確認する
2. Firestore Security Rulesを変更した場合は、先に `npm run test:rules` を実行し、必要なら `npx firebase deploy --only firestore:rules` で反映する
3. 通常のビルド前チェックを実行する

```powershell
npm test
npx tsc --noEmit
npm run lint
```

`npm test` のFirestore Rules系テストは、Firestore Emulator未起動時にskipされる。Rules自体を検証したい場合は `npm run test:rules` を使う。

### EAS production build

```powershell
npx eas build --platform ios --profile production --non-interactive
```

- `eas.json` は `appVersionSource: "remote"`、productionは `autoIncrement: true` のため、iOS buildNumberはEAS側で自動採番される
- Free planのiOS build枠上限に当たった場合、buildNumberだけ進んでartifactが作成されないことがある。その場合は枠リセット後に再実行する
- `GoogleService-Info.plist` はGitに含めず、EAS production環境の file secret `GOOGLE_SERVICE_INFO_PLIST` から注入する

### TestFlight反映

EAS Build完了後、App Store Connect / TestFlightへsubmitする。

```powershell
npx eas submit --platform ios --profile production --latest --non-interactive
```

- `--latest` は直近で完了したiOS build artifactをsubmit対象にする
- 複数buildがある場合や対象を明示したい場合は、EAS Buildの詳細画面に表示されるbuild IDを使う

```powershell
npx eas submit --platform ios --profile production --id <EAS_BUILD_ID> --non-interactive
```

1. submit完了後、App Store ConnectのTestFlightで処理状況を確認する
2. 外部テスター向けbuildはBeta App Review待ちになる場合がある
3. 配布後、[docs/testflight-history.md](testflight-history.md) の該当buildに確認結果と発見事項を追記する

## Phase 4: App Store配布

App Storeへの提出に必要なメタデータ・スクリーンショット・課金/返金説明・プライバシー栄養表示の本文は [docs/app-store-submission-draft.md](app-store-submission-draft.md) を正とする。本セクションは「実施タスク」のみを管理する。

- [x] Apple Developer Program 登録（TestFlight配布実績あり＝登録済み。有料IAP提供には別途 App Store Connect の有料App契約〈Paid Applications Agreement〉締結が必要）
- [ ] アプリアイコン・スプラッシュスクリーン（既存があれば更新要否を確認）
- [x] App Storeの言語表示を日本語にする（`app.json` の `infoPlist` に `CFBundleDevelopmentRegion: ja` / `CFBundleLocalizations: [ja]` を設定済み〈2026-07-03〉。未設定だとバイナリの宣言が英語扱いになり、ストアの言語欄が「EN」と表示される）
- [ ] EAS production build を作成（手順は本書「TestFlightビルド発行手順」参照）
- [ ] TestFlight → App Store審査申請（本書の「App Store配布前の運用・品質ゲート」を満たした状態で実行）

## App Store配布前の運用・品質ゲート

バイブコーディング由来の事故を避けるため、リリース前に以下を確認する。

- [x] Firebaseプロジェクト、Firestoreデータ、App Check、EAS secretsについて、開発/検証/本番の分離方針を決める（`docs/operations-release-gate.md`）
- [x] Firebase/GCPの課金単位、無料枠、Firestore読み取り/書き込み/保存容量の概算を確認する（`docs/firestore-read-and-index-plan.md`）
- [ ] Google Cloud Billingで本番向け予算アラートを設定する（`docs/firestore-read-and-index-plan.md` のランブックに従う）
- [x] リリース直後、週次、月次でFirebase/GCP請求ダッシュボードを確認する運用を決める（`docs/operations-release-gate.md`）
- [x] 記録、履歴、集計、設定の主要画面について、想定データ件数とFirestore読み取り回数を見積もる（`docs/firestore-read-and-index-plan.md`）
- [x] 履歴検索や集計など、将来データ量が増える導線で必要なインデックス・ページング・取得範囲制限を確認する（`docs/firestore-read-and-index-plan.md`）
- [x] 本番データのバックアップ/エクスポート、復旧手順、削除系操作の事前確認方法を決める（`docs/operations-release-gate.md`）
- [x] Firestoreデータモデル変更時は、ステージングまたはテストデータで移行手順・ロールバック・件数確認を試す（`docs/operations-release-gate.md`）
- [x] クラッシュ、認証失敗、Firestore権限エラー、App Check失敗、同期失敗を検知するログ/監視方針を決める（`docs/operations-release-gate.md`）
- [x] ログや問い合わせ調査に、金額、メモ、店舗名、個人情報、認証情報、Firebase secretを含めない方針を確認する（`docs/operations-data-access-policy.md`, `docs/operations-release-gate.md`）
- [x] 障害/漏えい/誤削除が起きた場合の初動、影響範囲確認、ユーザー告知、再発防止記録の流れを決める（`docs/operations-release-gate.md`）
- [x] 依存ライブラリの実在、メンテ状況、ライセンス、脆弱性、lockfile固定を確認する（`docs/dependency-audit-2026-05-10.md`）
- [x] OSSライセンス表記を作成し、production依存ライセンス一覧を参照できるようにする（`THIRD_PARTY_NOTICES.md`, `docs/third-party-licenses.csv`）
- [x] App Store提出情報（プライバシー栄養表示・公的データ利用有無・課金説明・返金/解約説明）のドラフトを作成する（`docs/app-store-submission-draft.md`）
- [x] プライバシーポリシーを確認する（`docs/privacy-policy.md`）
- [ ] App Storeプライバシー栄養表示を確認する（`docs/app-store-submission-draft.md` を基に App Store Connect で最終入力）
- [x] 公的データ出典の最終表記を確認する（現行版では公的統計データを同梱・加工利用しないため非該当。`docs/app-store-submission-draft.md`）
- [ ] CSVインポートIAPのApp Store Connect側設定と実機確認を行う（価格は初期リリース ¥300 で決定済み。アプリ側の購入/復元導線はexpo-iapで実装済み〈2026-07-03、`lib/csvImportIap.ts`〉。残タスク: Family Sharing対応可否の決定・設定のみ（プロダクト作成とSandbox/TestFlightでの購入・復元・キャンセル確認は完了）。**Sandbox側は2026-07-03 dev-clientで全項目確認済み**: 購入→インポート解放、購入を復元→解放、購入シートのキャンセル、未購入アカウントでの復元→見つからない表示。**TestFlight実機（build 26発見事項#7の修正後）でも購入アラート表示・購入/復元・キャンセル導線の正常動作を確認済み**。`docs/app-store-submission-draft.md`, `docs/privacy-and-monetization.md`）
- [x] CSVインポートIAPの返金/復元説明を確認する（`docs/app-store-submission-draft.md`）
