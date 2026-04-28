# Cloud Firestore移行

## 決定

iCloud Drive + SQLite によるファイル同期を断念し、Cloud Firestore + Apple Sign-In による世帯共有へ方針転換する。

## 背景

iCloud Drive + SQLite によるファイル同期を Phase 3 として調査した結果、以下の理由で採用しないことにした。

- SQLite ファイルを iCloud ubiquity container に直接配置するのは Apple ガイドライン違反
- 実用的なライブラリ `react-native-cloud-store` は pre-stable・ソロメンテナーで信頼性に難
- 妻と私で別々の場所で同時更新し、レコード単位でマージする要件を満たせない

## 旧調査メモ

- 調査1 Gist: [research-best-practices-for-icloud-drive-file-sync-in-react-native-expo-sdk-54](https://gist.github.com/minoru365/cbf8f0f758f6d5f7f4901feea1fc02f7)
- 調査2 Gist: [research-expo-file-system-icloud-drive-sync-sqlite-database-between-ios-devices](https://gist.github.com/minoru365/eb30301530a16af66eaaaaa3db7f8336)
- 調査3 Gist: [research-react-native-cloud-store-vs-expo-icloud-integration-for-shared-sqlite](https://gist.github.com/minoru365/b5cb4e81c5e4fa7d96604ee569713daa)
- 調査4 Gist: [research-multi-device-sqlite-sync-strategies-for-ios-household-apps-using-icloud](https://gist.github.com/minoru365/3772951aba2e05e98a27f737aa3474fa)

## 採用技術

- DB: Cloud Firestore（オフライン永続化内蔵、リアルタイムリスナー）
- 認証: Apple Sign-In（App Store要件にも合致）
- SQLite: 完全置換（Firestoreのオフラインキャッシュに委任）
- 既存SQLiteデータ: 移行しない。Phase 3移行時点で破棄し、Firestore上で新規データとして開始する
- ビルド: expo-dev-client へ移行（React Native Firebase がネイティブモジュール必須）
- 競合解決: 同一レコードへの同時更新は `serverTimestamp()` による last-write-wins
