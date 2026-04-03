# moneyplanner — アーキテクチャ概要

## 全体構成

```mermaid
graph TD
    subgraph iPhone
        subgraph Expo Go / ビルド済みアプリ
            subgraph expo-router
                Layout[app/_layout.tsx<br/>ルートレイアウト]
                Tabs[app/tabs/_layout.tsx<br/>タブナビゲーション]
                Index[記録タブ<br/>index.tsx]
                History[履歴タブ<br/>history.tsx]
                Summary[集計タブ<br/>summary.tsx]
                Plan[計画タブ<br/>plan.tsx]
                Settings[設定タブ<br/>settings.tsx]
            end

            subgraph lib
                DB[database.ts<br/>SQLite操作]
                CSV[csvExport.ts<br/>CSV生成・共有]
            end

            subgraph ストレージ
                SQLite[(moneyplanner.db<br/>SQLite)]
            end
        end

        iCloud[(iCloud Drive<br/>Phase 3)]
    end

    Layout -->|副作用import| DB
    DB -->|openDatabaseSync| SQLite
    Tabs --> Index & History & Summary & Plan & Settings
    Index & History & Summary & Settings -->|CRUD| DB
    Settings -->|exportCSV| CSV
    CSV -->|読み取り| DB
    CSV -->|writeAsStringAsync| iCloud
    SQLite -.->|自動同期 Phase 3| iCloud
```

---

## 画面構成（5タブ）

```mermaid
graph LR
    A[記録] --> B[履歴]
    B --> C[集計]
    C --> D[計画]
    D --> E[設定]

    A:::active
    classDef active fill:#1565C0,color:#fff
```

| タブ | ファイル                  | 主な機能                                 |
| ---- | ------------------------- | ---------------------------------------- |
| 記録 | `app/(tabs)/index.tsx`    | 収支入力フォーム・カテゴリ選択・日付入力 |
| 履歴 | `app/(tabs)/history.tsx`  | リスト表示・カレンダービュー             |
| 集計 | `app/(tabs)/summary.tsx`  | 月次・年次・カテゴリ別集計               |
| 計画 | `app/(tabs)/plan.tsx`     | ライフプラン（Phase 2）                  |
| 設定 | `app/(tabs)/settings.tsx` | カテゴリ管理・CSV出力                    |

---

## データベース設計

```mermaid
erDiagram
    categories {
        INTEGER id PK
        TEXT name
        TEXT type "income / expense"
        TEXT color "HEXカラー"
        INTEGER is_default "1=デフォルト（削除不可）"
    }

    transactions {
        INTEGER id PK
        TEXT date "YYYY-MM-DD"
        INTEGER amount
        TEXT type "income / expense"
        INTEGER category_id FK
        TEXT memo
        TEXT created_at
    }

    categories ||--o{ transactions : "category_id"
```

### デフォルトカテゴリ

| 種別 | カテゴリ                                                                                 |
| ---- | ---------------------------------------------------------------------------------------- |
| 収入 | 給与・副業・その他収入                                                                   |
| 支出 | 食費・住居費・光熱費・通信費・交通費・医療費・娯楽費・衣服費・教育費・保険料・その他支出 |

---

## DB初期化フロー

```mermaid
sequenceDiagram
    participant OS as iOS
    participant Layout as app/_layout.tsx
    participant DB as lib/database.ts
    participant SQLite as SQLite

    OS->>Layout: アプリ起動
    Layout->>DB: import（副作用）
    DB->>SQLite: openDatabaseSync('moneyplanner.db')
    DB->>SQLite: CREATE TABLE IF NOT EXISTS categories
    DB->>SQLite: CREATE TABLE IF NOT EXISTS transactions
    DB->>SQLite: カテゴリ件数チェック
    alt 0件（初回起動）
        DB->>SQLite: デフォルトカテゴリ14件INSERT
    end
    Layout-->>OS: 描画開始
```

> **重要**: `initDatabase()` はモジュールロード時に自動実行される。`useEffect`内で呼ばない（タイミング競合の原因）。

---

## CSV出力フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Settings as settings.tsx
    participant CSV as csvExport.ts
    participant DB as database.ts
    participant FS as expo-file-system
    participant Share as expo-sharing

    User->>Settings: CSV出力ボタンをタップ
    Settings->>CSV: exportCSV()
    CSV->>DB: getAllTransactions()
    DB-->>CSV: Transaction[]
    CSV->>CSV: BOM付きUTF-8に変換
    CSV->>FS: writeAsStringAsync(path, csv)
    CSV->>Share: shareAsync(path)
    Share-->>User: 共有シート表示
```

---

## Phase 3: Firebase同期（計画中）

```mermaid
sequenceDiagram
    participant A as デバイスA（夫）
    participant Firestore as Cloud Firestore
    participant B as デバイスB（妻）

    A->>Firestore: 収支を記録（addDoc）
    Note over Firestore: serverTimestamp()でupdatedAt付与
    Firestore-->>B: onSnapshotリスナーでリアルタイム通知
    B-->>B: UI自動更新
    Note over A,B: 同一レコード同時更新時はlast-write-wins
```

- **同期方式**: Cloud Firestoreリアルタイムリスナー（`onSnapshot`）
- **オフライン**: Firestore内蔵のオフライン永続化で自動対応
- **認証**: Apple Sign-In + Firebase Auth
- **世帯共有**: 招待コード方式、6桁コードで家族が同一世帯に参加
- **競合解決**: `serverTimestamp()` による last-write-wins
- **実装要件**: expo-dev-client + React Native Firebase + EAS Build

---

## ファイルツリー

```
moneyplanner/
├── app/
│   ├── _layout.tsx          # ルートレイアウト・DB import
│   ├── +not-found.tsx
│   └── (tabs)/
│       ├── _layout.tsx      # タブ定義
│       ├── index.tsx        # 記録
│       ├── history.tsx      # 履歴
│       ├── summary.tsx      # 集計
│       ├── plan.tsx         # 計画
│       └── settings.tsx     # 設定
├── lib/
│   ├── database.ts          # SQLite操作・型定義
│   └── csvExport.ts         # CSV生成・共有
├── components/
│   ├── HapticTab.tsx
│   ├── ThemedText.tsx
│   ├── ThemedView.tsx
│   └── ui/
│       ├── IconSymbol.tsx
│       ├── IconSymbol.ios.tsx
│       ├── TabBarBackground.tsx
│       └── TabBarBackground.ios.tsx
├── constants/
│   └── Colors.ts
├── hooks/
│   ├── useColorScheme.ts
│   └── useThemeColor.ts
├── assets/
│   ├── fonts/SpaceMono-Regular.ttf
│   └── images/（アイコン類）
├── CLAUDE.md                # 開発ガイドライン
├── PLAN.md                  # 開発ロードマップ
└── ARCHITECTURE.md          # このファイル
```

---

## 技術スタック

| 用途           | パッケージ                             | バージョン                        |
| -------------- | -------------------------------------- | --------------------------------- |
| フレームワーク | Expo                                   | ~54.0.0                           |
| UI             | React Native                           | 0.81.5                            |
| ルーティング   | expo-router                            | ~6.0.23                           |
| DB             | Cloud Firestore                        | Phase 3で移行                     |
| 認証           | Apple Sign-In + Firebase Auth          | Phase 3で追加                     |
| Firebase       | @react-native-firebase/\*              | Phase 3で追加                     |
| ~~旧DB~~       | ~~expo-sqlite~~                        | ~~~16.0.10~~（Phase 3で削除予定） |
| CSV出力        | expo-file-system/legacy                | ~19.0.21                          |
| 共有           | expo-sharing                           | ~14.0.8                           |
| 日付入力       | @react-native-community/datetimepicker | 8.4.4                             |
| アニメーション | react-native-reanimated                | ~4.1.1                            |
