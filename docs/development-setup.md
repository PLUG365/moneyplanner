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
