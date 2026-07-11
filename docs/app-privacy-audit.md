# App Store プライバシー監査（ソース・production archive確認・暫定ドラフト）

最終更新日: 2026-07-11

## 目的と範囲

App Store Connect の「App Privacy」入力に向け、リポジトリ上の実装、EAS production build 31のread-only archive inspection、およびFirebase Consoleの確認結果をまとめる。この文書は法的助言または最終的なプライバシー判断ではない。App Store Connect への入力、SDKベンダー資料、Google Analyticsの各種設定、およびPrivacy ManifestのApp Store分類への適用は、人間レビューを経て確定する。

確認対象は、認証、Firestore、CSV入出力、QR招待、App Check、および `package.json` / `app.json` のリポジトリ内設定、build 31 IPA、Firebase Consoleの有効製品である。実在のユーザーレコード、秘密情報、外部コンソールの識別子は確認・記載しない。

## ソースで確認した事実

### 認証と識別子

- [lib/auth.ts](../lib/auth.ts) は Apple Sign-In の `identityToken` と、存在する場合の `authorizationCode` を Firebase Auth の `AppleAuthProvider.credential` へ渡す。Firebase Auth の現在ユーザーの `uid` は世帯・Firestore操作の識別に使用される。
- 同ファイルの `AppleAuthentication.signInAsync` は `requestedScopes: []` で呼び出されており、Apple の氏名またはメールアドレスのスコープは要求していない。
- [lib/memberProfile.ts](../lib/memberProfile.ts) はプロバイダー由来の表示名・メールアドレスを恒久保存せず、保存用プロフィールには固定の表示名だけを設定する。世帯参加時に入力するニックネームは [lib/household.ts](../lib/household.ts) の `users`、`members`、`joinRequests` に保存される。

### Firestore に保存する家計・世帯データ

- [lib/firestore.ts](../lib/firestore.ts) は世帯ID配下の `transactions`、`accounts`、`budgets`、`categories`、`breakdowns`、`stores` などを使用する。取引には日付、金額、収支種別、口座・カテゴリ・内訳・店舗のIDと表示用ラベル、メモ、作成者UIDが書き込まれる。口座残高、予算額、マスタのラベルも同じ世帯に保存される。
- [lib/household.ts](../lib/household.ts) は Firebase UID と世帯ID、ニックネーム、メンバー情報、招待コード、参加リクエスト・承認状態・試行回数等を保存する。
- したがって、これらのデータはアカウント/世帯との対応を持ち、家計簿、世帯共有、招待・参加機能の提供に使われる。

### QRコードとCSV

- [components/InviteQrScanner.tsx](../components/InviteQrScanner.tsx) は QR のスキャン文字列を [lib/inviteQr.ts](../lib/inviteQr.ts) で招待コード形式か検証し、形式が有効なコードだけを参加処理へ渡す。カメラ画像を保存または Firestore へ送信する処理は確認できない。
- [lib/csvImport.ts](../lib/csvImport.ts) はユーザーが選択した CSV を端末のキャッシュへコピーして読み取り、確認後に実行されたときだけ取引レコードを Firestore へ書き込む。生の選択CSVを Firestore へ送る処理は確認できない。
- [lib/csvExport.ts](../lib/csvExport.ts) はエクスポートCSVを端末の一時キャッシュに作成してユーザー主導の共有を行い、共有完了・キャンセルを問わず `finally` で一時ファイルを削除する。
- このため、カメラ画像、生の選択CSV、購入用の支払資格情報、IAPレシートを、このソースだけを根拠に「開発者が収集するデータ」とは分類しない。

### 明示的な利用が見つからない機能

- [package.json](../package.json)、[app.json](../app.json)、`app/`、`components/`、`lib/` の直接依存・実装には、Analytics、広告、ATT/IDFA、Crashlytics、Performance Monitoring、位置情報、連絡先、マイク、独自HTTPエンドポイントの宣言または利用は確認できない。
- lockfile上の推移的依存だけでは、これらのSDK機能が有効化・利用されているとは結論付けない。

### App Check と未確認のSDK挙動

- [lib/appCheck.ts](../lib/appCheck.ts) と [lib/appCheckConfig.ts](../lib/appCheckConfig.ts) は、productionのApple環境で App Attest と DeviceCheck フォールバックを使う Firebase App Check を初期化し、トークン自動更新を有効にする。
- App Check の証明・トークン、Firebaseおよび第三者SDKによる自動収集、IPアドレスの取扱い、Privacy Manifest、Firebase Consoleの実設定は、リポジトリのソースだけでは確定できない。

## build 31 archive inspection で確認した事実

EAS production build 31のIPAをread-onlyで検査した。これは実行時通信やApp Store Connectの入力値を検証したものではない。

- メイン実行ファイルに `FirebaseAnalytics` / `FIRAnalytics` のシンボルが含まれる。したがって、従来の「3種類だけ」のドラフトは不完全であり、Analyticsが不在である前提では最終化できない。
- `Info.plist` に `FIREBASE_ANALYTICS_COLLECTION_ENABLED`、`FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED`、`GOOGLE_ANALYTICS_IDFV_COLLECTION_ENABLED`、`GOOGLE_ANALYTICS_REGISTRATION_WITH_AD_NETWORK_ENABLED`、`FirebaseAutomaticScreenReportingEnabled` は存在しない。
- `AdSupport`、`ASIdentifierManager`、`GADApplicationIdentifier`、`GoogleAds`、`GoogleSignals` のシンボルは確認されなかった。この不在だけで、Google Analyticsの収集、ユーザーへの紐付け、またはトラッキングを「なし」と最終判断しない。
- IPA内のPrivacy Manifestは、FirebaseAuthについて `User ID`（Linked to the user、Not used for tracking、App Functionality）および `Other Diagnostic Data`（Not linked、Not used for tracking、Analytics）を宣言する。FirebaseFirestoreとFirebaseFirestoreInternalは、それぞれ `Other Diagnostic Data`（Not linked、Not used for tracking、Analytics）を宣言する。
- FirebaseAnalyticsのPrivacy ManifestバンドルはIPAに含まれない。これはAnalytics不在の証拠にはならない。Firebase公式資料では、最新のGoogle Analytics SDKはPrivacy Manifestを含めない一方、アプリのライフサイクル/画面表示イベントを自動収集し、アプリインスタンスIDを割り当て、マスクしたIPアドレスから一般的な位置情報を導出するとされる。StoreKit利用時のIAP自動イベントの有無は未解決のままとする。
- Firebase ConsoleではGoogle Analyticsプロパティが有効であることを確認した。Crashlytics、Performance、Cloud Messaging、Remote Config、Storageは未構成である。

## build 31 IPA内の追加確認（GoogleAppMeasurement有無の切り分け）

build 31のIPA内で、実際のAnalytics収集エンジン（GoogleAppMeasurement）が同梱されているかを追加確認した。これも実行時通信を検証したものではない。

- IPA内の `Payload/mina.app/` 直下には、`FirebaseAuth_Privacy.bundle`、`FirebaseFirestore_Privacy.bundle`、`FirebaseFirestoreInternal_Privacy.bundle`、`FirebaseCore_Privacy.bundle`、`FirebaseCoreInternal_Privacy.bundle`、`FirebaseCoreExtension_Privacy.bundle`、`GoogleUtilities_Privacy.bundle`、`GTMSessionFetcher_Core_Privacy.bundle` など、実際にリンクされているFirebase系ポッドのPrivacy Manifestバンドルが存在する。一方、`GoogleAppMeasurement`または`FirebaseAnalytics`名のPrivacy Manifestバンドルは存在しない。
- メイン実行ファイルへの文字列検索では、`FIRAnalytics`/`FirebaseAnalytics`は4件ヒットする一方、GoogleAppMeasurementの内部実装に特有のシンボル（`GoogleAppMeasurement`、`APMMeasurement`、`FIRAEventLogger`）は0件だった。GoogleAppMeasurement内部で使われる`FIRA`接頭辞のシンボル（`FIRAEvent`/`FIRAApp`/`FIRAConfiguration`等）を束ねて検索すると1件ヒットしたが、単独では収集エンジンの存在を確定できない。
- この結果は、FirebaseAuth/FirebaseFirestoreが依存する軽量な`FirebaseAnalyticsInterop`プロトコル（Analyticsが存在する場合にだけイベント連携するための任意インターフェース）だけが含まれ、実際の収集エンジン（GoogleAppMeasurement）はリンクされていない可能性を示唆する。ただし、`nm`/`strings`によるMach-O解析ではなく本ツールでの文字列検索に基づく簡易確認であり、静的リンク後のシンボル欠落・難読化・部分一致の可能性を排除できない。
- したがって、「build 31にAnalytics収集エンジンが実際に含まれる」という従来の前提は確定情報ではなく、上記の追加確認は疑わしいと判断する根拠を示す。この不確実性は、下記のプロダクト判断・実装（Analytics収集の無効化）を妨げない。無効化は、収集エンジンが実在する場合は実効を持ち、実在しない場合は無害な変更である。

## 暫定 App Store Connect ドラフト

**未入力・人間レビュー待ち。** 以下はソース監査とbuild 31 archive inspectionに基づく候補であり、App Store Connect に入力済みであることを示さない。従来の3種類だけの候補は、build 31にAnalyticsが含まれる証拠の確認により置き換える。

| App Store のデータ型候補 | ソース上の対応データ | 利用目的 | ユーザーへの紐付け | トラッキング |
| --- | --- | --- | --- | --- |
| User ID | Firebase UID、世帯IDとの対応、メンバー・招待参加の識別子 | App Functionality | Linked to the user | Not used for tracking |
| Other Financial Info | 取引日・金額・収支種別、残高、予算、口座・カテゴリ・店舗の家計データ | App Functionality | Linked to the user | Not used for tracking |
| Other User Content | ニックネーム、招待・メンバーシップ情報、口座・カテゴリ・店舗ラベル、自由記述メモ | App Functionality | Linked to the user | Not used for tracking |
| Other Diagnostic Data | FirebaseAuth、FirebaseFirestore、FirebaseFirestoreInternalのPrivacy Manifestが宣言する診断データ | Analytics（Manifest上はNot linked、Not used for tracking） | 要人間レビュー（Manifest上はNot linked） | 要人間レビュー（Manifest上はNot used for tracking） |
| Product Interaction | Google Analytics SDKによるアプリのライフサイクル・画面表示の自動イベント | Analytics | 要人間レビュー | 要人間レビュー |
| Coarse Location | Google Analytics SDKがマスクしたIPアドレスから導出する一般的な位置情報 | Analytics | 要人間レビュー | 要人間レビュー |

最初の3候補は、家計簿と世帯共有の機能提供を目的とするFirestore保存内容に限る。追加した3候補は、Google Analytics設定（Google signals、Google Adsリンク、データ共有）を人間が確認するまで、ユーザーへの紐付けとトラッキングを確定しない。広告SDK・ATT/IDFA関連のシンボルは確認されなかったが、それだけを根拠にAnalytics由来データの最終値を決めない。

## 最終化しないデータ型と人間レビュー質問

次の項目は「収集なし」と最終入力しない。ソースだけでは App Store の定義、SDKの自動処理、または本番アーカイブの挙動を確定できないためである。

| データ型 | 最終化しない理由 | 人間レビューで回答する質問 |
| --- | --- | --- |
| Purchase History | IAPの購入状態を扱う実装はあり、Google Analytics SDKのStoreKit利用時の自動イベント挙動も未解決である。レシートや購入履歴を開発者が収集・保存することは、ソースおよびarchive inspectionから確定できない。 | App Store Connect、Appleの購入処理、StoreKit、expo-iap、Firebaseの本番設定で、開発者またはSDKが購入履歴・レシートを収集、保持、送信するか。 |
| Product Interaction | build 31にGoogle Analytics SDKが含まれ、公式資料ではライフサイクル・画面表示イベントの自動収集が示される。 | Google Analyticsの設定と現行資料に照らして、該当イベントを`Product Interaction`として申告するか。ユーザーへの紐付けとトラッキングはどう分類するか。 |
| Coarse Location | 公式資料ではGoogle Analytics SDKがマスクしたIPアドレスから一般的な位置情報を導出するとされる。 | App Storeの`Coarse Location`として申告するか。Google signals、Google Adsリンク、データ共有を確認したうえで、ユーザーへの紐付けとトラッキングをどう分類するか。 |
| Other Data | 招待コード、参加試行回数、状態メタデータのApple分類が、この3候補だけで十分かは判断を要する。 | 招待・不正利用対策のメタデータに、上表以外の App Store データ型を追加する必要があるか。 |
| Device ID | App Check は端末の証明・トークンを使うが、アプリが端末IDをFirestoreへ保存する実装は確認できない。 | App Attest、DeviceCheck、Firebase App Check、関連SDKが App Store 定義上の Device ID または同等の識別子を収集するか。IPアドレスを含む自動収集はあるか。 |
| Other Diagnostic Data | Privacy ManifestにはFirebaseAuth、FirebaseFirestore、FirebaseFirestoreInternalによる宣言がある一方、Google Analytics由来データを含めた最終分類は未確定である。 | Manifest上のNot linked/Not used for trackingを、実際のGoogle Analytics設定と併せてApp Store Connectへどう反映するか。 |
| Name | Appleの氏名・メールアドレスは要求・恒久保存しない一方、ユーザー入力のニックネームはFirestoreへ保存する。自由入力なので実名になる可能性を排除できない。 | ニックネームを App Store の「Name」として申告すべきか。実名を求めない仕様・UI・運用であることを確認できるか。 |

## 最終化前のプロダクト判断

App Store Connectの最終入力と公開プライバシーポリシーの確定前に、次のいずれかをプロダクトとして決定する必要がある。

1. Analyticsを維持し、Google Analytics設定の人間レビュー後にApp Storeのプライバシー栄養表示と公開プライバシーポリシーをAnalyticsの実際の収集内容に合わせて更新する。
2. 将来のbuildでAnalytics収集を無効化し、TestFlightで再検証してから、更新後のアーカイブ証拠に基づきプライバシー栄養表示と公開プライバシーポリシーを確定する。

**2026-07-11時点の決定: 選択肢2（Analytics収集の無効化）で進める。** [app.json](../app.json) の `ios.infoPlist` に `FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED: true` を追加済み。このキーはFirebase公式のAnalytics収集の恒久停止フラグで、`GOOGLE_ANALYTICS_IDFV_COLLECTION_ENABLED`等の個別キーより優先される。ビルド時設定のため、次回EAS production buildから反映される。

未完了（人間レビュー対象）:

- 次回buildの production archiveをinspectし、`Info.plist`に`FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED`が反映されていることを確認する。ただしこのキーは実行時の収集停止フラグであり、リンク時に依存する`FIRAnalytics`関連シンボルやFirebaseAuth/Firestoreのinterop依存自体は次回buildでも残る。シンボルの消失を再確認の基準にしない。
- 収集が実際に止まったかは静的解析では確定できないため、Firebase Console（Analytics DebugViewやリアルタイムレポート）で新build起動後にイベントが記録されないことをTestFlight実機で確認する。
- 上表のデータ型候補のうち、`Product Interaction`と`Coarse Location`はGoogle Analytics（GoogleAppMeasurement）由来のため、上記の無効化確認結果を踏まえて確定する。
- `Other Diagnostic Data`はFirebaseAuth/FirebaseFirestoreのPrivacy Manifestに由来し、Analytics無効化の影響を受けず今回のbuildでも引き続き宣言されるため、Analyticsの判断とは切り離して別途確定する。
- プライバシーポリシーの記載を、上記の確定結果に合わせて更新する。

## 最終入力前の確認手順

1. ~~Google Analyticsを維持するか、将来buildで収集を無効化して再検証するかを決定する。~~ → 2026-07-11、無効化の方向で決定済み（[最終化前のプロダクト判断](#最終化前のプロダクト判断)参照）。
2. （維持する場合の手順。今回は非該当）Google signals、Google Adsリンク、データ共有を含むGoogle Analytics設定を人間が確認し、追加3候補のユーザーへの紐付けとトラッキングを判断する。
3. 次回buildのproduction archiveとTestFlightでAnalytics無効化を再検証する。利用SDKの現行ベンダー資料とPrivacy Manifestを確認し、App Checkを含む自動収集、IPアドレス、端末識別子の開示要否を判断する。
4. `Purchase History`、`Device ID`を含む未確定項目を人間が判断し、App Store Connect の最終値を入力する。入力内容を [app-store-submission-draft.md](app-store-submission-draft.md) と [privacy-policy.md](privacy-policy.md) に照合する。

## 関連ドキュメント

- [App Store 提出情報ドラフト](app-store-submission-draft.md)
- [プライバシーポリシー草案](privacy-policy.md)
- [リリースチェックリスト](release-checklist.md)
