# 開発環境セットアップ

## ローカル（PC）

JavaScriptの開発サーバーはローカルPCで起動できます。ただし、React Native Firebase はネイティブモジュールを使うため、実機で動かすアプリ本体は TestFlight または expo-dev-client ビルドが必要です。Expo Go では認証・Firestore・App Checkの実動作確認はできません。

```bash
git clone https://github.com/minoru365/moneyplanner.git
cd moneyplanner
npm install
npx expo start
```

`npx expo start` は dev-client にJavaScriptを配信するためのコマンドです。TestFlightのproductionビルドは、この開発サーバーではなくビルド済みアプリ単体で確認します。

Firebase iOS設定ファイル `GoogleService-Info.plist` はGit管理外です。ローカルでネイティブビルドを作る場合はリポジトリ直下に配置し、EAS production buildでは file secret `GOOGLE_SERVICE_INFO_PLIST` から注入します。

TestFlight/dev-client の検証履歴と次の検証対象は [TestFlight履歴](testflight-history.md) を参照してください。

## dev-clientでの動作確認

JavaScriptだけの変更（画面、フック、`lib/` のロジック）は、dev-clientビルドを入れ直さずに確認できます。ネイティブモジュールや `app.json` / `app.config.js` の設定を変えた場合はビルドし直しが必要です。

### dev-clientビルドを入れる

すでにiPhoneにdev-clientが入っているならこの節は飛ばして「PC側」へ進みます。

#### 1. 使える既存ビルドがあるか確認する

```powershell
npx eas build:list --platform ios --profile development
```

[expo.dev](https://expo.dev) のプロジェクトページからも一覧できます。**成功しているビルドが残っていて、その後にネイティブ依存（`package.json` のネイティブモジュール、`app.json` / `app.config.js` / `plugins/`）を変更していなければ、それをそのまま入れられます。** ビルド成果物には保持期限があるため、古いものはダウンロードできないことがあります。

#### 2. iPhoneをプロビジョニングに登録する（その端末で初めて入れる場合のみ）

internal distribution のビルドは、端末のUDIDがプロビジョニングプロファイルに含まれていないとインストールできません。

```powershell
npx eas device:create
```

表示された登録URL/QRをiPhoneのSafariで開き、案内に従ってプロファイルをインストールします（設定アプリに「プロファイルがダウンロードされました」が出るので、そこから完了させます）。

> ⚠️ **登録は次のビルドから反映されます。** すでに作成済みのビルドには、あとから登録した端末は含まれません。この場合は登録後にビルドし直しが必要です。

#### 3. ビルドする（既存ビルドが使えない場合）

```powershell
npx eas build --profile development --platform ios
```

> ⚠️ `npx eas build` は、ユーザーが明示的に指示したときにだけ実行します（「EAS操作」節を参照）。AIエージェントが自己判断で実行してはいけません。

**iOSのビルド枠を消費します。** dev-clientビルドもproductionビルドと同じ枠を使うため、リリース用ビルドを控えているときは残数に注意します（過去に枠上限でビルドが止まった記録が [TestFlight履歴](testflight-history.md) にあります）。

#### 4. インストールする

ビルド完了後にEASが出すインストールURL/QRを、**iPhoneのSafariで開きます**。ホーム画面へのインストールを承認すれば完了です。`npx eas build:list` の各ビルド詳細からも同じURLを取得できます。

起動時に開発元の信頼を求められた場合は、設定 → 一般 → VPNとデバイス管理 から許可します。

#### 5. 既存のTestFlight版・App Store版がある場合

3つのビルド（App Store版・TestFlight版・dev-client）は bundle identifier が同じ `com.minoru.moneyplanner` なので、**iPhoneに共存できません。dev-clientを入れると既存のアプリが置き換わります。**

- **家計データはFirestore（クラウド）にあるため失われません。** 再サインインすれば元通りです
- ただし **Apple Sign-Inのセッション、Firestoreのローカルキャッシュ、`scopeVersions.json` は消える前提**で考えます
- 製品版に戻すときはTestFlightまたはApp Storeから入れ直します（これも上書きです）

キャッシュの挙動を確認したい変更では、この「ローカルキャッシュが空の状態」が結果を左右します。インストール直後にいきなり確認せず、**一度アプリを使ってキャッシュを温め、スワイプで終了してから再起動した状態**で確認します。

dev用に bundle identifier を分けて共存させる方法もありますが、`GoogleService-Info.plist` がbundle IDに紐づくためFirebaseプロジェクトに2つ目のiOSアプリ登録と別plistの管理が必要になります。App CheckとApple Sign-Inの設定もそれぞれ要るため、常用する前提が固まるまでは採用しません。

### PC側

```powershell
cd C:\Users\rnmgy\dev\moneyplanner
npx expo start
```

- iPhoneとPCが**同じWi-Fi**にいる必要があります。別ネットワークなら `npx expo start --tunnel` を使います
- 起動するとQRコードと接続URL（`exp+moneyplanner://expo-development-client/?url=http://<PCのIP>:8081` 形式）が表示されます
- ターミナルで `r` を押すとiPhone側がリロードします

### iPhone側

1. ホーム画面から **NANBO - みんなの家計簿** を開きます
   - dev-clientビルドはproductionと同じ bundle identifier（`com.minoru.moneyplanner`）・同じ表示名です。**アイコンでは見分けがつきません**
2. 開発サーバー未接続の状態で起動すると、dev-clientのランチャー画面が出ます
   - 同じWi-Fi上の開発サーバーが一覧に出ていればタップします
   - 出ない場合は、iPhoneの**カメラアプリ**でPC側のQRコードを読み取ります（dev-clientが起動します）
   - それでも繋がらない場合は、ランチャーのURL入力欄に上記の接続URLを直接入れます
3. 接続後はPC側の変更が自動でリロードされます
4. **端末を振る**と開発者メニューが開きます（Reload / 開発サーバーの切断など）

### 取引の読み書きに触る変更の定型確認

`lib/firestore.ts`、`hooks/useCachedTransactions.ts`、`hooks/usePaginatedTransactions.ts`、キャッシュ・鮮度判定まわりを変更したら、毎回この7点を確認します。個別の変更に固有の確認項目は、これに追加する形で決めます。

1. 記録タブで保存 → 集計タブの合計に反映されている
2. 記録タブで保存 → 履歴タブの一覧に出ている
3. 履歴で金額を編集して保存 → 集計の合計が新しい金額になっている
4. 履歴で削除 → 集計・履歴の両方から消えている
5. 集計タブで年を切り替えて戻す → データが消えたり古い値に戻ったりしない
6. **機内モードで記録** → 集計・履歴に反映される（未送信の書き込みがディスクキャッシュ経由で読めるかの確認。オフライン系の退行はここで出る）
7. 設定 → 口座管理の残高が正しい（残高更新も同じ書き込み経路を通るため、影響が一番遠いところに出る）

タブ切替や初回表示が体感で重くなっていないかも併せて見ます。重くなっていれば、キャッシュを使わずに読み直している回数が増えている可能性があります。

## GitHub Codespaces（ブラウザ上で開発）

PCがなくてもブラウザだけで開発できる環境です。Node.jsなどの環境構築は不要で、起動するだけで使えます。

ただし、React Native Firebase の実動作確認はネイティブビルドが必要なため、Codespaces上のWebプレビューでは認証・Firestore・App Checkの検証は行いません。

### 起動手順

1. [Code] ボタン → [Codespaces] タブ → [Create codespace on master]
2. ブラウザ上でVS Codeが開き、`npm install` が自動実行される

### 動作確認

```bash
npx expo start --tunnel
```

表示されたQRコードをdev-clientビルド済みのiPhoneで開く。

> `--tunnel` はdev-clientへJavaScriptを配信するための確認用です。Codespaces上のWebプレビューやExpo Goでは、Firebase/Auth/App Checkの本番相当確認は行いません。

## EAS操作

`npx eas build`、`npx eas build:inspect`、EAS submitは、この会話でユーザーから明示的な承認を得た後にだけ実行します。リリース準備、テスト完了、pre-buildゲートの通過から実行を推測してはいけません。手順と確認項目は [release checklist](release-checklist.md) を参照してください。
