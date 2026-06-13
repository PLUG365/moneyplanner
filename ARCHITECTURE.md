# moneyplanner — アーキテクチャ概要

## 全体構成

```mermaid
graph TD
    subgraph iPhone["iPhone"]
        subgraph NativeBuild["TestFlight / dev-client ビルド"]
            subgraph ExpoRouter["expo-router"]
                Layout["app/_layout.tsx<br/>ルートレイアウト"]
                Auth["auth.tsx<br/>ログイン"]
                Household["household.tsx<br/>世帯作成・参加"]
                Tabs["app/(tabs)/_layout.tsx<br/>タブナビゲーション"]
                Index["記録タブ<br/>index.tsx"]
                History["履歴タブ<br/>history.tsx"]
                Summary["集計タブ<br/>summary.tsx"]
                Settings["設定タブ<br/>settings.tsx"]
            end

            subgraph Lib["lib"]
                AuthLib["auth.ts<br/>Firebase Auth"]
                HouseholdLib["household.ts<br/>世帯管理"]
                DB["firestore.ts<br/>Firestore CRUD"]
                CSV["csvExport.ts<br/>CSV生成・共有"]
                AppCheck["appCheck.ts<br/>App Check初期化"]
            end
        end
    end

    subgraph Firebase["Firebase"]
        FirebaseAuth[(Firebase Auth<br/>Apple Sign-In)]
        Firestore[(Cloud Firestore<br/>households / users / inviteCodes)]
        AppCheckService[(Firebase App Check)]
    end

    Layout -->|App Check readiness| AppCheck
    Layout -->|認証状態監視| AuthLib
    Layout -->|世帯ID確認| HouseholdLib
    Auth --> AuthLib
    Household --> HouseholdLib
    Tabs --> Index
    Tabs --> History
    Tabs --> Summary
    Tabs --> Settings
    Index -->|CRUD| DB
    History -->|CRUD| DB
    Summary -->|CRUD| DB
    Settings -->|CRUD| DB
    Settings -->|exportCSV| CSV
    CSV -->|読み取り| DB
    CSV -->|writeAsStringAsync + shareAsync| Share[共有シート]
    AuthLib --> FirebaseAuth
    HouseholdLib --> Firestore
    DB -->|onSnapshot + batch + transaction| Firestore
    AppCheck --> AppCheckService
```

---

## 画面構成（4タブ）

```mermaid
graph LR
    A[記録] --> B[履歴]
    B --> C[集計]
    C --> D[設定]

    A:::active
    classDef active fill:#1565C0,color:#fff
```

| タブ | ファイル                  | 主な機能                                 |
| ---- | ------------------------- | ---------------------------------------- |
| 記録 | `app/(tabs)/index.tsx`    | 収支入力フォーム・カテゴリ選択・日付入力 |
| 履歴 | `app/(tabs)/history.tsx`  | リスト表示・カレンダービュー             |
| 集計 | `app/(tabs)/summary.tsx`  | 月次・年次・カテゴリ別集計               |
| 設定 | `app/(tabs)/settings.tsx` | カテゴリ管理・CSV出力・世帯管理          |

---

## データベース設計

```mermaid
erDiagram
    users {
        string uid PK
        string householdId
        string displayName
        Timestamp createdAt
    }

    households {
        string id PK
        string createdBy
        string inviteCode
        Timestamp createdAt
    }

    members {
        string uid PK
        string displayName
        Timestamp joinedAt
        Timestamp removedAt
        boolean rejoinDisabled
    }

    transactions {
        string id PK
        string date "YYYY-MM-DD"
        number amount
        string type "income / expense"
        string accountId FK "null可: マスタ非紐付け（表示はaccountNameSnapshot）"
        string accountNameSnapshot
        string categoryId FK
        string categoryNameSnapshot
        string categoryColorSnapshot
        string breakdownId FK
        string breakdownNameSnapshot
        string storeId FK
        string storeNameSnapshot
        string memo
        string createdBy
        Timestamp createdAt
        Timestamp updatedAt
    }

    categories {
        string id PK
        string name
        string type "income / expense"
        string color
        boolean isDefault
        number displayOrder
    }

    breakdowns {
        string id PK
        string categoryId FK
        string name
        boolean isDefault
    }

    accounts {
        string id PK
        string name
        number balance
        number initialBalance
        boolean isDefault
    }

    budgets {
        string categoryId PK
        number amount
    }

    stores {
        string id PK
        string name
        string categoryId FK
        Timestamp lastUsedAt
    }

    storeCategoryUsage {
        string id PK "storeId_categoryId"
        string storeId FK
        string categoryId FK
        Timestamp lastUsedAt
    }

    inviteCodes {
        string code PK
        string householdId FK
        string createdBy
        Timestamp createdAt
        Timestamp expiresAt
        Timestamp disabledAt
    }

    joinRequests {
        string requestId PK
        string uid
        string displayName
        string inviteCode
        string status "pending / approved / rejected"
        Timestamp requestedAt
        Timestamp reviewedAt
    }

    users }o--|| households : "householdId"
    households ||--o{ members : "members"
    households ||--o{ transactions : "transactions"
    households ||--o{ categories : "categories"
    households ||--o{ accounts : "accounts"
    households ||--o{ stores : "stores"
    households ||--o{ storeCategoryUsage : "storeCategoryUsage"
    households ||--o{ joinRequests : "joinRequests"
    households ||--|| inviteCodes : "inviteCode"
    categories ||--o{ breakdowns : "categoryId"
    categories ||--o{ budgets : "categoryId"
    categories ||--o{ transactions : "categoryId"
    accounts ||--o{ transactions : "accountId"
    stores ||--o{ transactions : "storeId"
```

### Firestore コレクション詳細

```text
/users/{userId}
    - householdId: string
    - displayName: string
    - createdAt: Timestamp
    - inviteJoinFailedAttempts?: number （招待コード失敗回数）
    - inviteJoinCooldownUntil?: Timestamp （クールダウン終了時刻）
    - inviteJoinLastFailedAt?: Timestamp

/inviteCodes/{code}                              # トップレベルコレクション
    - householdId: string
    - createdBy: string
    - createdAt: Timestamp
    - expiresAt: Timestamp
    - disabledAt?: Timestamp

/households/{householdId}
    - createdBy: string (userId)
    - inviteCode: string (6文字、参加用)
    - createdAt: Timestamp

    # 以下、すべて /households/{householdId} 配下のサブコレクション

    /members/{userId}
        - displayName: string
        - joinedAt: Timestamp
        - removedAt?: Timestamp
        - rejoinDisabled?: boolean （解除済みメンバーの再参加抑止フラグ）

    /joinRequests/{requestId} （参加承認フローで使用中）
        - uid: string
        - displayName: string
        - inviteCode: string
        - status: pending | approved | rejected
        - requestedAt, reviewedAt?: Timestamp

    /categories/{categoryId}
        - name, type, color, isDefault, displayOrder
        - updatedAt: Timestamp

    /breakdowns/{breakdownId}
        - categoryId, name, isDefault
        - updatedAt: Timestamp

    /transactions/{transactionId}
        - date, amount, type, accountId, categoryId, breakdownId, storeId
        - accountNameSnapshot, categoryNameSnapshot, categoryColorSnapshot
        - breakdownNameSnapshot, storeNameSnapshot
        - memo, createdAt, updatedAt: Timestamp
        - createdBy: string (userId)

    /accounts/{accountId}
        - name, balance, initialBalance, isDefault
        - createdAt, updatedAt: Timestamp

    /stores/{storeId}
        - name, categoryId, lastUsedAt: Timestamp

    /storeCategoryUsage/{storeId_categoryId}
        - storeId, categoryId, lastUsedAt: Timestamp

    /budgets/{categoryId}
        - categoryId, amount
        - updatedAt: Timestamp
```

### デフォルトカテゴリ

| 種別 | カテゴリ                                                                     |
| ---- | ---------------------------------------------------------------------------- |
| 収入 | 給与所得・賞与・臨時収入・配当金                                             |
| 支出 | 食費・日用雑貨・住まい・通信・交通・教育・クルマ・税金・大型出費・その他など |

### 月次日付レンジ方針

- 取引・予算系の月次クエリは `YYYY-MM-31` 固定ではなく、`lib/yearMonthDateRange.ts` で開始日・終了日を生成する
- 2月、うるう年を含む月境界を同一ルールで扱い、`lib/yearMonthDateRange.test.ts` で検証する

---

## Firestore初期化フロー

```mermaid
sequenceDiagram
    participant OS as iOS
    participant Layout as app/_layout.tsx
    participant AppCheck as lib/appCheck.ts
    participant Auth as Firebase Auth
    participant Household as lib/household.ts
    participant DB as lib/firestore.ts
    participant Firestore as Cloud Firestore

    OS->>Layout: アプリ起動
    Layout->>AppCheck: initAppCheck()
    AppCheck-->>Layout: 成功/失敗にかかわらず起動継続
    Layout->>Auth: onAuthStateChanged
    alt 未ログイン
        Layout-->>OS: /auth へ遷移
    else ログイン済み
        Layout->>Household: getHouseholdId()
        Household->>Firestore: users/{uid} と members/{uid} を確認
        alt 世帯未所属/解除済み
            Layout-->>OS: /household へ遷移
        else 有効な世帯メンバー
            Layout->>DB: initFirestore()
            DB->>Firestore: デフォルトカテゴリ・内訳・口座を冪等作成
            Layout-->>OS: /(tabs) へ遷移
        end
    end
```

> **重要**: `lib/database.ts` / `expo-sqlite` は撤去済み。Firestore初期化は認証・世帯確認後に `initFirestore()` で行う。

---

## CSV出力フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Settings as settings.tsx
    participant CSV as csvExport.ts
    participant DB as firestore.ts
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

## Phase 3: Firebase同期

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
- **世帯共有**: 招待コード方式、6文字コードで家族が同一世帯に参加
- **競合解決**: `serverTimestamp()` による last-write-wins
- **実装要件**: expo-dev-client + React Native Firebase + EAS Build

---

## ファイルツリー

詳細なファイル単位の役割はコードを正とし、ここでは主要ディレクトリの責務だけを示す。

```text
moneyplanner/
├── app/                     # expo-routerのルート（auth, household, (tabs)/...、dev-ui-preview）
├── lib/                     # ドメインロジック（Firestore CRUD、認証、世帯、集計、CSV、入力検証など）
├── components/              # 再利用UIコンポーネント（TransactionEditor、MoneyInputModal等）
├── constants/               # カラーパレット、固定値
├── hooks/                   # useFirestore（リアルタイムリスナー）、useColorScheme等
├── assets/                  # フォント、アイコン
├── firestore.rules          # Firestore Security Rules
├── firestore.rules.test.ts  # Rules エミュレータテスト
├── firebase.json            # Firestore Emulator設定
├── app.config.js            # EAS secret から GoogleService-Info.plist 注入
├── eas.json                 # EAS Build プロファイル（development/preview/production）
├── PLAN.md                  # 進捗とタスク
├── README.md                # プロジェクト概要・ドキュメント目次
└── ARCHITECTURE.md          # このファイル
```

主要モジュールの責務:

| ディレクトリ/ファイル                                      | 責務                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `lib/firestore.ts`                                         | Firestore CRUD 全体（取引/カテゴリ/口座/予算/世帯設定）と型定義の中心 |
| `lib/auth.ts`                                              | Firebase Auth + Apple Sign-In                                         |
| `lib/household.ts`                                         | 世帯作成・招待コード・参加リクエスト・メンバー管理                    |
| `lib/summaryAggregation.ts`                                | 月次/年次集計・予算進捗の純関数集計ロジック                           |
| `lib/csvExport.ts`                                         | CSV生成・共有                                                         |
| `lib/csvImport.ts`                                         | CSV取り込み（検証は `csvImportParse.ts`、マスタ解決は Resolve に分離）|
| `lib/historySearch.ts`                                     | 履歴フィルタリング条件                                                |
| `lib/moneyInput.ts`                                        | 金額入力の正規化・四則演算評価                                        |
| `hooks/useFirestore.ts`                                    | Firestore リアルタイム購読 + fromCache メタデータ                     |
| `components/TransactionEditor.tsx`                         | 記録/履歴編集の共通フォーム                                           |
| `components/MoneyInputModal.tsx` / `NumericInputModal.tsx` | 金額・数値入力モーダル（共通部品）                                    |
| `components/HistorySearchPanel.tsx`                        | 履歴の検索条件パネル                                                  |
| `components/ProgressOverlay.tsx`                           | 重い処理用の進捗オーバーレイ（CSV取り込み等。件数表示/不明の2モード） |

---

## 技術スタック

| 用途           | パッケージ                                          | バージョン                 |
| -------------- | --------------------------------------------------- | -------------------------- |
| フレームワーク | Expo                                                | ~54.0.0                    |
| UI             | React Native                                        | 0.81.5                     |
| ルーティング   | expo-router                                         | ~6.0.23                    |
| DB             | Cloud Firestore                                     | 世帯単位のリアルタイム同期 |
| 認証           | Apple Sign-In + Firebase Auth                       | 世帯共有                   |
| Firebase       | @react-native-firebase/app/auth/firestore/app-check | ネイティブSDK              |
| ビルド         | expo-dev-client + EAS Build / TestFlight            | iOS実機検証                |
| CSV出力        | expo-file-system/legacy                             | ~19.0.21                   |
| 共有           | expo-sharing                                        | ~14.0.8                    |
| 日付入力       | @react-native-community/datetimepicker              | 8.4.4                      |
| アニメーション | react-native-reanimated                             | ~4.1.1                     |
