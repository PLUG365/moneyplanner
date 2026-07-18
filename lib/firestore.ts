import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocFromCache,
    getDocFromServer,
    getDocs,
    getFirestore,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
    type DocumentData,
} from "@react-native-firebase/firestore";
import { buildAccountBalanceReconciliation } from "./accountBalanceReconciliation";
import { getHouseholdDeletionCollectionNames } from "./accountDeletion";
import { getCurrentUser } from "./auth";
import {
  buildBreakdownDisplayOrderPatch,
  sortBreakdownsForDisplay,
} from "./breakdownOrdering";
import {
    buildCategoryDisplayOrderPatch,
    sortCategoriesForDisplay,
} from "./categoryOrdering";
import { getSnapshotDataOrNull, snapshotExists } from "./firestoreSnapshot";
import { getHouseholdId } from "./household";
import {
    buildBudgetMasterRestorePlan,
    buildStoreMasterRestorePlan,
    buildTransactionMasterRelinkPatch,
} from "./masterRelink";
import { type DataVersion } from "./readFreshness";
import { buildStoreOptionsForCategory, findStoreByName } from "./storeOptions";
import { excludeDeletedTransactionDocs } from "./transactionSoftDelete";
import {
    buildBudgetStatusesFromData,
    buildMonthCategorySummaryFromTransactions,
    buildYearMonthlyTotalsFromTransactions,
} from "./summaryAggregation";
import {
    buildBalanceAdjustmentsForCreate,
    buildBalanceAdjustmentsForDelete,
    buildBalanceAdjustmentsForUpdate,
} from "./transactionBalance";
import {
    buildTransactionWriteMetadata,
    type TransactionWriteMetadataInput,
} from "./transactionWriteMetadata";
import { fromYearMonthDate, toYearMonthDate } from "./yearMonthDateRange";

// ── モジュラーAPI 型エイリアス ────────────────────────
// RNFirebase v24 はモジュラー型名（Query / DocumentReference 等）を同名の
// 実装クラスと二重にエクスポートしており、型名を直接importすると実装クラス側へ
// 解決されて型が合わない。モジュラー関数のシグネチャから型を導出して使う。
export type FirestoreQuery = Parameters<
  typeof getDocs<DocumentData, DocumentData>
>[0];
export type FirestoreCollectionRef = Parameters<
  typeof addDoc<DocumentData, DocumentData>
>[0];
export type FirestoreDocRef = Parameters<
  typeof getDoc<DocumentData, DocumentData>
>[0];
export type FirestoreQuerySnapshot = Awaited<
  ReturnType<typeof getDocs<DocumentData, DocumentData>>
>;
export type FirestoreQueryDocSnapshot = FirestoreQuerySnapshot["docs"][number];
type FirestoreDocSnapshot = Awaited<
  ReturnType<typeof getDoc<DocumentData, DocumentData>>
>;
type FirestoreWriteBatch = ReturnType<typeof writeBatch>;

// ── 定数 ──────────────────────────────────────────────
export const DEFAULT_ACCOUNT_ID = "default";
export const DEFAULT_ACCOUNT_NAME = "家計";
const DATA_VERSION_META_DOC_ID = "dataVersion";

// ── 型定義（Firestore 版: ID は string）──────────────
export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  isDefault: boolean;
  displayOrder: number | null;
}

export interface Breakdown {
  id: string;
  categoryId: string;
  name: string;
  isDefault: boolean;
  displayOrder: number | null;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  initialBalance: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  categoryId: string | null;
  lastUsedAt: string;
}

export interface MonthlyBudget {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
}

export interface BudgetDefinition {
  categoryId: string;
  amount: number;
}

export type BudgetAlertLevel = "none" | "warning" | "exceeded";

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgetAmount: number;
  spentAmount: number;
  usageRate: number;
  level: BudgetAlertLevel;
  fromCache: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  // null = どの口座マスタにも紐づかない（インポートで未知の口座名だった場合等）。
  // 表示は accountName スナップショットを使う。categoryId 等と同じ扱い。
  accountId: string | null;
  accountName: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  breakdownId: string | null;
  breakdownName: string;
  storeId: string | null;
  storeName: string;
  memo: string;
  createdAt: string;
}

export interface MonthlyCategorySummary {
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
}

export interface MonthlyTotal {
  month: number;
  income: number;
  expense: number;
}

export interface CategoryDeletionImpact {
  transactionCount: number;
  breakdownCount: number;
  hasBudget: boolean;
}

// ── ヘルパー ─────────────────────────────────────────
let _cachedHouseholdId: string | null = null;
let _householdIdPromise: Promise<string> | null = null;

async function ensureHouseholdId(): Promise<string> {
  if (_cachedHouseholdId) return _cachedHouseholdId;
  if (!_householdIdPromise) {
    _householdIdPromise = getHouseholdId().then((id) => {
      if (!id) throw new Error("世帯が未設定です");
      _cachedHouseholdId = id;
      _householdIdPromise = null;
      return id;
    });
  }
  return _householdIdPromise;
}

export function clearHouseholdCache() {
  _cachedHouseholdId = null;
  _householdIdPromise = null;
}

async function householdDoc() {
  const hid = await ensureHouseholdId();
  return doc(getFirestore(), "households", hid);
}

export function householdCollection(
  householdId: string,
  collectionName: string,
): FirestoreCollectionRef {
  return collection(getFirestore(), "households", householdId, collectionName);
}

function toISOString(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  return ts.toDate().toISOString();
}

type BatchOp = (batch: FirestoreWriteBatch) => void;

function dataVersionDoc(hDoc: FirestoreDocRef) {
  return doc(collection(hDoc, "meta"), DATA_VERSION_META_DOC_ID);
}

function dataVersionPayload() {
  return { updatedAt: serverTimestamp() };
}

function bumpDataVersionInBatch(
  batch: FirestoreWriteBatch,
  hDoc: FirestoreDocRef,
): void {
  batch.set(dataVersionDoc(hDoc), dataVersionPayload(), { merge: true });
}

function dataVersionFromSnapshot(snap: FirestoreDocSnapshot): DataVersion {
  const updatedAt = snap.data()?.updatedAt;
  if (!updatedAt) return null;
  if (typeof updatedAt.toMillis === "function") {
    return String(updatedAt.toMillis());
  }
  if (typeof updatedAt.toDate === "function") {
    return updatedAt.toDate().toISOString();
  }
  return String(updatedAt);
}

export async function readHouseholdDataVersion(
  householdId: string,
  source: "cache" | "server" = "server",
): Promise<DataVersion> {
  try {
    const versionRef = doc(
      getFirestore(),
      "households",
      householdId,
      "meta",
      DATA_VERSION_META_DOC_ID,
    );
    const snap =
      source === "cache"
        ? await getDocFromCache(versionRef)
        : await getDocFromServer(versionRef);
    if (!snapshotExists(snap)) return null;
    return dataVersionFromSnapshot(snap);
  } catch (error) {
    if (source === "cache") return null;
    throw error;
  }
}

/** マーカーをサーバー優先で読み、オフライン等でサーバー読みが失敗したら
 *  キャッシュ（最後に同期した版）へフォールバックする。フレッシュネス判定用。 */
export async function readHouseholdDataVersionPreferServer(
  householdId: string,
): Promise<DataVersion> {
  try {
    return await readHouseholdDataVersion(householdId, "server");
  } catch {
    return await readHouseholdDataVersion(householdId, "cache");
  }
}

async function commitBatchOps(ops: BatchOp[]): Promise<void> {
  const LIMIT = 499;
  for (let i = 0; i < ops.length; i += LIMIT) {
    const batch = writeBatch(getFirestore());
    const chunk = ops.slice(i, i + LIMIT);
    for (const op of chunk) op(batch);
    await batch.commit();
  }
}

async function deleteCollectionDocs(
  collectionRef: FirestoreCollectionRef,
): Promise<void> {
  const snapshot = await getDocs(collectionRef);
  if (snapshot.empty) return;
  const ops: BatchOp[] = snapshot.docs.map(
    (doc) => (batch) => batch.delete(doc.ref),
  );
  await commitBatchOps(ops);
}

/** スナップショットのドキュメント群を499件ずつのバッチで削除し、
 *  コミットごとに削除件数をコールバックする（進捗表示用）。 */
async function deleteDocsInBatches(
  docs: FirestoreQueryDocSnapshot[],
  onDocsDeleted?: (count: number) => void,
): Promise<void> {
  const LIMIT = 499;
  for (let i = 0; i < docs.length; i += LIMIT) {
    const chunk = docs.slice(i, i + LIMIT);
    const batch = writeBatch(getFirestore());
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    onDocsDeleted?.(chunk.length);
  }
}

async function restoreStoreMastersFromTransactionSnapshots(
  hDoc: FirestoreDocRef,
  transactions: FirestoreQueryDocSnapshot[],
  categoryIdByTransactionId?: Map<string, string | null>,
): Promise<void> {
  // ソフトデリート済み取引からお店マスタを復活させない
  const plan = buildStoreMasterRestorePlan(
    excludeDeletedTransactionDocs(transactions).map((doc) => {
      const data = doc.data();
      return {
        transactionId: doc.id,
        type: data.type as TransactionType,
        storeName: data.storeNameSnapshot || "",
        categoryId:
          categoryIdByTransactionId?.get(doc.id) ?? data.categoryId ?? null,
      };
    }),
  );

  if (plan.stores.length === 0) return;

  const storeRefsByKey = new Map<string, FirestoreDocRef>();
  const ops: BatchOp[] = [];

  for (const store of plan.stores) {
    const ref = doc(collection(hDoc, "stores"));
    storeRefsByKey.set(store.key, ref);
    ops.push((batch) =>
      batch.set(ref, {
        name: store.name,
        categoryId: store.categoryId,
        lastUsedAt: serverTimestamp(),
      }),
    );
  }

  for (const usage of plan.usages) {
    const storeRef = storeRefsByKey.get(usage.storeKey);
    if (!storeRef) continue;
    ops.push((batch) =>
      batch.set(
        doc(
          collection(hDoc, "storeCategoryUsage"),
          `${storeRef.id}_${usage.categoryId}`,
        ),
        {
          storeId: storeRef.id,
          categoryId: usage.categoryId,
          lastUsedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  }

  for (const [transactionId, storeKey] of plan.transactionStoreKeys) {
    const storeRef = storeRefsByKey.get(storeKey);
    if (!storeRef) continue;
    ops.push((batch) =>
      batch.update(doc(collection(hDoc, "transactions"), transactionId), {
        storeId: storeRef.id,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  if (plan.transactionStoreKeys.size > 0) {
    ops.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(ops);
}

async function resolveTransactionSnapshot(
  hDoc: FirestoreDocRef,
  categoryId: string,
  breakdownId?: string | null,
): Promise<{
  categoryName: string;
  categoryColor: string;
  breakdownName: string;
}> {
  const categoryPromise = getDoc(
    doc(collection(hDoc, "categories"), categoryId),
  );
  const breakdownPromise = breakdownId
    ? getDoc(doc(collection(hDoc, "breakdowns"), breakdownId))
    : Promise.resolve(null);

  const [categorySnap, breakdownSnap] = await Promise.all([
    categoryPromise,
    breakdownPromise,
  ]);

  return {
    categoryName: categorySnap.data()?.name ?? "未分類",
    categoryColor: categorySnap.data()?.color ?? "#666666",
    breakdownName: breakdownSnap?.data()?.name ?? "",
  };
}

async function resolveAccountName(
  hDoc: FirestoreDocRef,
  accountId: string,
): Promise<string> {
  const snap = await getDoc(doc(collection(hDoc, "accounts"), accountId));
  return snap.data()?.name ?? DEFAULT_ACCOUNT_NAME;
}

async function resolveStoreName(
  hDoc: FirestoreDocRef,
  storeId?: string | null,
): Promise<string> {
  if (!storeId) return "";
  const snap = await getDoc(doc(collection(hDoc, "stores"), storeId));
  return snap.data()?.name ?? "";
}

// ── マッピング ───────────────────────────────────────
export function mapCategory(id: string, data: DocumentData): Category {
  return {
    id,
    name: data.name,
    type: data.type as TransactionType,
    color: data.color,
    isDefault: !!data.isDefault,
    displayOrder:
      typeof data.displayOrder === "number" ? data.displayOrder : null,
  };
}

export function mapBreakdown(id: string, data: DocumentData): Breakdown {
  return {
    id,
    categoryId: data.categoryId,
    name: data.name,
    isDefault: !!data.isDefault,
    displayOrder:
      typeof data.displayOrder === "number" ? data.displayOrder : null,
  };
}

export function mapTransaction(id: string, data: DocumentData): Transaction {
  return {
    id,
    date: data.date,
    amount: data.amount,
    type: data.type as TransactionType,
    accountId: data.accountId ?? null,
    accountName: data.accountNameSnapshot || DEFAULT_ACCOUNT_NAME,
    categoryId: data.categoryId ?? null,
    categoryName: data.categoryNameSnapshot || "未分類",
    categoryColor: data.categoryColorSnapshot || "#666666",
    breakdownId: data.breakdownId ?? null,
    breakdownName: data.breakdownNameSnapshot || "",
    storeId: data.storeId ?? null,
    storeName: data.storeNameSnapshot || "",
    memo: data.memo || "",
    createdAt: toISOString(data.createdAt),
  };
}

/** ソフトデリート済みを除外して Transaction[] へ変換する。
 *  取引一覧の読み取り（履歴/検索/集計/CSV/フック）は必ずこれを通し、
 *  `deleted` 除外の漏れを防ぐ（ADR: transaction-soft-delete）。 */
export function mapActiveTransactions(
  docs: FirestoreQueryDocSnapshot[],
): Transaction[] {
  return excludeDeletedTransactionDocs(docs).map((docSnap) =>
    mapTransaction(docSnap.id, docSnap.data()),
  );
}

export function mapAccount(id: string, data: DocumentData): Account {
  return {
    id,
    name: data.name,
    balance: data.balance ?? 0,
    initialBalance:
      typeof data.initialBalance === "number" ? data.initialBalance : null,
    isDefault: !!data.isDefault,
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
  };
}

export function mapBudgetDefinition(
  id: string,
  data: DocumentData,
): BudgetDefinition {
  return {
    categoryId: data.categoryId ?? id,
    amount: data.amount ?? 0,
  };
}

function mapStore(id: string, data: DocumentData): Store {
  return {
    id,
    name: data.name,
    categoryId: data.categoryId ?? null,
    lastUsedAt: toISOString(data.lastUsedAt),
  };
}

function mapStoreCategoryUsage(data: DocumentData): {
  storeId: string;
  categoryId: string;
  lastUsedAt: string;
} {
  return {
    storeId: data.storeId,
    categoryId: data.categoryId,
    lastUsedAt: toISOString(data.lastUsedAt),
  };
}

// ── デフォルトカテゴリ ───────────────────────────────
const DEFAULT_CATEGORIES: {
  name: string;
  type: TransactionType;
  color: string;
  breakdowns: string[];
}[] = [
  {
    name: "水道・光熱",
    type: "expense",
    color: "#C62828",
    breakdowns: ["ガス料金", "電気料金", "水道料金"],
  },
  {
    name: "医療・保険",
    type: "expense",
    color: "#AD1457",
    breakdowns: ["生命保険", "医療保険", "薬代", "病院代", "その他"],
  },
  {
    name: "クルマ",
    type: "expense",
    color: "#7B1FA2",
    breakdowns: [
      "自動車保険",
      "その他",
      "高速料金",
      "駐車場",
      "ガソリン",
      "自動車税",
      "免許教習",
    ],
  },
  {
    name: "住まい",
    type: "expense",
    color: "#4527A0",
    breakdowns: ["家賃", "家具", "家電", "その他", "住宅ローン返済"],
  },
  {
    name: "通信",
    type: "expense",
    color: "#283593",
    breakdowns: [
      "インターネット関連費",
      "切手・はがき",
      "携帯電話料金",
      "放送サービス料金",
      "その他",
    ],
  },
  {
    name: "食費",
    type: "expense",
    color: "#1565C0",
    breakdowns: ["食料品", "昼ご飯", "カフェ", "晩ご飯", "その他", "朝ご飯"],
  },
  {
    name: "日用雑貨",
    type: "expense",
    color: "#0277BD",
    breakdowns: ["子ども関連", "消耗品", "その他", "ペット関連"],
  },
  {
    name: "美容・衣服",
    type: "expense",
    color: "#00838F",
    breakdowns: [
      "クリーニング",
      "その他",
      "美容院",
      "下着",
      "洋服",
      "子ども服",
      "子供服資材",
      "アクセサリー・小物",
      "コスメ",
      "ジム・健康",
    ],
  },
  {
    name: "エンタメ",
    type: "expense",
    color: "#00695C",
    breakdowns: [
      "イベント",
      "書籍",
      "その他",
      "レジャー",
      "音楽",
      "漫画",
      "映画・動画",
      "ゲーム",
    ],
  },
  {
    name: "交通",
    type: "expense",
    color: "#2E7D32",
    breakdowns: ["その他", "電車", "タクシー", "バス"],
  },
  { name: "その他", type: "expense", color: "#558B2F", breakdowns: [] },
  {
    name: "交際費",
    type: "expense",
    color: "#9E9D24",
    breakdowns: ["その他", "プレゼント", "飲み会", "ご祝儀・香典"],
  },
  {
    name: "税金",
    type: "expense",
    color: "#EF6C00",
    breakdowns: ["その他", "住民税", "年金", "ふるさと納税"],
  },
  {
    name: "小遣い",
    type: "expense",
    color: "#D84315",
    breakdowns: ["夫", "妻", "子供"],
  },
  {
    name: "教育・教養",
    type: "expense",
    color: "#6D4C41",
    breakdowns: [
      "習い事",
      "その他",
      "受験料",
      "参考書",
      "学費",
      "給食費",
      "塾",
    ],
  },
  {
    name: "大型出費",
    type: "expense",
    color: "#455A64",
    breakdowns: ["家電", "住宅", "自動車", "家具", "その他", "旅行"],
  },
  { name: "給与所得", type: "income", color: "#1565C0", breakdowns: [] },
  { name: "賞与", type: "income", color: "#1976D2", breakdowns: [] },
  { name: "臨時収入", type: "income", color: "#42A5F5", breakdowns: [] },
  { name: "配当金", type: "income", color: "#0097A7", breakdowns: [] },
];

// ── Init / Reset ─────────────────────────────────────

/**
 * デフォルトカテゴリ・内訳・口座を初期投入する（冪等）。
 * 世帯作成後または世帯参加後にレイアウトから呼ぶ。
 */
export async function initFirestore(): Promise<void> {
  const hDoc = await householdDoc();

  const categoriesSnap = await getDocs(
    query(collection(hDoc, "categories"), limit(1)),
  );
  if (!categoriesSnap.empty) return;

  const batch = writeBatch(getFirestore());
  const displayOrderByType: Record<TransactionType, number> = {
    income: 0,
    expense: 0,
  };

  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = doc(collection(hDoc, "categories"));
    const displayOrder = displayOrderByType[cat.type]++;
    batch.set(catRef, {
      name: cat.name,
      type: cat.type,
      color: cat.color,
      isDefault: true,
      displayOrder,
      updatedAt: serverTimestamp(),
    });

    for (const [displayOrder, breakdownName] of cat.breakdowns.entries()) {
      const bdRef = doc(collection(hDoc, "breakdowns"));
      batch.set(bdRef, {
        categoryId: catRef.id,
        name: breakdownName,
        isDefault: true,
        displayOrder,
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.set(doc(collection(hDoc, "accounts"), DEFAULT_ACCOUNT_ID), {
    name: DEFAULT_ACCOUNT_NAME,
    balance: 0,
    initialBalance: 0,
    isDefault: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function resetFirestoreForDevelopment(): Promise<void> {
  if (!__DEV__) {
    throw new Error("DBリセットは開発環境でのみ実行できます");
  }

  const hDoc = await householdDoc();
  const collections = [
    "transactions",
    "accounts",
    "budgets",
    "stores",
    "storeCategoryUsage",
    "breakdowns",
    "categories",
  ];

  for (const name of collections) {
    await deleteCollectionDocs(collection(hDoc, name));
  }

  await initFirestore();

  // データを全削除したことをキャッシュ側に伝えるためマーカーを更新する
  // （meta は削除対象に含めていないので、明示的にバンプしないと古い版のままになる）。
  const versionBatch = writeBatch(getFirestore());
  bumpDataVersionInBatch(versionBatch, hDoc);
  await versionBatch.commit();
}

export async function deleteHouseholdDataAndCurrentUserProfile(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    throw new Error("ログイン情報を確認できません");
  }

  const hDoc = await householdDoc();
  const collectionNames = getHouseholdDeletionCollectionNames();

  // 進捗はドキュメント件数ベースで報告する。コレクション単位だと transactions の
  // 大量削除中にバーが止まって見える（build 27 実機報告）。削除対象を先に
  // 読み取って総件数を確定してから、バッチコミットごとに進捗を進める。
  const collectionSnaps: FirestoreQuerySnapshot[] = [];
  for (const name of collectionNames) {
    collectionSnaps.push(await getDocs(collection(hDoc, name)));
  }
  const inviteSnap = await getDocs(
    query(
      collection(getFirestore(), "inviteCodes"),
      where("householdId", "==", hDoc.id),
    ),
  );
  const membersSnap = await getDocs(collection(hDoc, "members"));

  const totalDocs =
    collectionSnaps.reduce((sum, snap) => sum + snap.size, 0) +
    inviteSnap.size +
    membersSnap.size +
    2; // 世帯ドキュメント + users プロフィール
  let doneDocs = 0;
  const reportProgress = () => onProgress?.(doneDocs, totalDocs);
  reportProgress();

  for (const snap of collectionSnaps) {
    await deleteDocsInBatches(snap.docs, (count) => {
      doneDocs += count;
      reportProgress();
    });
  }

  // 招待コード → (members + 世帯ドキュメント) → users の順を守る。
  // members 削除後は activeMember 資格を失い、世帯側の削除ができなくなる。
  await deleteDocsInBatches(inviteSnap.docs, (count) => {
    doneDocs += count;
    reportProgress();
  });

  // members と世帯ドキュメントは1バッチで削除する。Security Rules は members の
  // 存在を activeMember 判定の根拠にするが、ルールはバッチ前の状態で評価されるため
  // まとめてなら消せる。
  const finalBatch = writeBatch(getFirestore());
  finalBatch.delete(hDoc);
  membersSnap.docs.forEach((memberDoc) => finalBatch.delete(memberDoc.ref));
  await finalBatch.commit();
  doneDocs += membersSnap.size + 1;
  reportProgress();

  await deleteDoc(doc(getFirestore(), "users", uid));
  doneDocs += 1;
  reportProgress();
  clearHouseholdCache();
}

export async function resetCategoryAndBreakdownsToDefault(): Promise<void> {
  const hDoc = await householdDoc();

  const [
    txSnap,
    oldCategorySnap,
    oldBudgetSnap,
    oldStoreSnap,
    oldUsageSnap,
    oldBreakdownSnap,
  ] = await Promise.all([
    getDocs(collection(hDoc, "transactions")),
    getDocs(collection(hDoc, "categories")),
    getDocs(collection(hDoc, "budgets")),
    getDocs(collection(hDoc, "stores")),
    getDocs(collection(hDoc, "storeCategoryUsage")),
    getDocs(collection(hDoc, "breakdowns")),
  ]);
  const oldCategories = oldCategorySnap.docs.map((doc) =>
    mapCategory(doc.id, doc.data()),
  );
  const oldBudgets = oldBudgetSnap.docs.map((doc) =>
    mapBudgetDefinition(doc.id, doc.data()),
  );

  // 先に新マスタを作って取引を貼り替え、最後に旧マスタを掃除することで
  // 途中失敗時の「全消し状態」を避ける。
  const createOps: BatchOp[] = [];
  const relinkCategories: Category[] = [];
  const relinkBreakdownsByCategory = new Map<string, Breakdown[]>();
  const displayOrderByType: Record<TransactionType, number> = {
    income: 0,
    expense: 0,
  };
  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = doc(collection(hDoc, "categories"));
    const relinkBreakdowns: Breakdown[] = [];
    const displayOrder = displayOrderByType[cat.type]++;
    relinkCategories.push({
      id: catRef.id,
      name: cat.name,
      type: cat.type,
      color: cat.color,
      isDefault: true,
      displayOrder,
    });
    createOps.push((batch) =>
      batch.set(catRef, {
        name: cat.name,
        type: cat.type,
        color: cat.color,
        isDefault: true,
        displayOrder,
        updatedAt: serverTimestamp(),
      }),
    );
    for (const [displayOrder, breakdownName] of cat.breakdowns.entries()) {
      const bdRef = doc(collection(hDoc, "breakdowns"));
      relinkBreakdowns.push({
        id: bdRef.id,
        categoryId: catRef.id,
        name: breakdownName,
        isDefault: true,
        displayOrder,
      });
      createOps.push((batch) =>
        batch.set(bdRef, {
          categoryId: catRef.id,
          name: breakdownName,
          isDefault: true,
          displayOrder,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    relinkBreakdownsByCategory.set(catRef.id, relinkBreakdowns);
  }

  const restoredBudgets = buildBudgetMasterRestorePlan(
    oldBudgets,
    oldCategories,
    relinkCategories,
  );
  const budgetOps: BatchOp[] = restoredBudgets.map(
    (budget) => (budgetBatch) =>
      budgetBatch.set(doc(collection(hDoc, "budgets"), budget.categoryId), {
        categoryId: budget.categoryId,
        amount: budget.amount,
        updatedAt: serverTimestamp(),
      }),
  );
  createOps.push(...budgetOps);

  const categoryIdByTransactionId = new Map<string, string | null>();
  const relinkOps: BatchOp[] = txSnap.docs.map((doc) => {
    const data = doc.data();
    const patch = buildTransactionMasterRelinkPatch(
      {
        type: data.type as TransactionType,
        categoryName: data.categoryNameSnapshot || "",
        breakdownName: data.breakdownNameSnapshot || "",
      },
      {
        categories: relinkCategories,
        breakdownsByCategory: relinkBreakdownsByCategory,
      },
    );
    categoryIdByTransactionId.set(doc.id, patch.categoryId);
    return (relinkBatch) =>
      relinkBatch.update(doc.ref, {
        ...patch,
        updatedAt: serverTimestamp(),
      });
  });
  createOps.push(...relinkOps);
  if (txSnap.size > 0) {
    createOps.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(createOps);

  await restoreStoreMastersFromTransactionSnapshots(
    hDoc,
    txSnap.docs,
    categoryIdByTransactionId,
  );

  const deleteOp =
    (doc: FirestoreQueryDocSnapshot): BatchOp =>
    (batch) =>
      batch.delete(doc.ref);
  const cleanupOps: BatchOp[] = [
    ...oldUsageSnap.docs.map(deleteOp),
    ...oldStoreSnap.docs.map(deleteOp),
    ...oldBreakdownSnap.docs.map(deleteOp),
    ...oldCategorySnap.docs.map(deleteOp),
    ...oldBudgetSnap.docs.map(deleteOp),
  ];
  await commitBatchOps(cleanupOps);
}

// ── Categories ───────────────────────────────────────

export async function getCategories(
  type?: TransactionType,
): Promise<Category[]> {
  const hDoc = await householdDoc();
  let categoriesQuery: FirestoreQuery = collection(hDoc, "categories");
  if (type) {
    categoriesQuery = query(categoriesQuery, where("type", "==", type));
  }
  const snap = await getDocs(categoriesQuery);
  return sortCategoriesForDisplay(
    snap.docs.map((doc) => mapCategory(doc.id, doc.data())),
  );
}

export async function addCategory(
  name: string,
  type: TransactionType,
  color: string,
): Promise<string> {
  const hDoc = await householdDoc();
  const sameTypeSnap = await getDocs(
    query(collection(hDoc, "categories"), where("type", "==", type)),
  );
  const displayOrder = sameTypeSnap.docs.reduce((maxOrder, doc) => {
    const value = doc.data().displayOrder;
    return typeof value === "number" ? Math.max(maxOrder, value + 1) : maxOrder;
  }, sameTypeSnap.size);
  const ref = await addDoc(collection(hDoc, "categories"), {
    name,
    type,
    color,
    isDefault: false,
    displayOrder,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategoryDisplayOrders(
  categories: Category[],
): Promise<void> {
  const hDoc = await householdDoc();
  const patch = buildCategoryDisplayOrderPatch(categories);
  const ops: BatchOp[] = patch.map(
    (item) => (batch) =>
      batch.update(doc(collection(hDoc, "categories"), item.id), {
        displayOrder: item.displayOrder,
        updatedAt: serverTimestamp(),
      }),
  );
  await commitBatchOps(ops);
}

export async function deleteCategory(id: string): Promise<void> {
  const hDoc = await householdDoc();
  const ops: BatchOp[] = [];

  // トランザクション更新
  const txSnap = await getDocs(
    query(collection(hDoc, "transactions"), where("categoryId", "==", id)),
  );
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        categoryId: null,
        breakdownId: null,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  // 予算削除
  ops.push((batch) => batch.delete(doc(collection(hDoc, "budgets"), id)));

  // 内訳削除
  const bdSnap = await getDocs(
    query(collection(hDoc, "breakdowns"), where("categoryId", "==", id)),
  );
  for (const doc of bdSnap.docs) {
    ops.push((batch) => batch.delete(doc.ref));
  }

  // カテゴリ削除
  ops.push((batch) => batch.delete(doc(collection(hDoc, "categories"), id)));

  if (txSnap.size > 0) {
    ops.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(ops);
}

export async function getCategoryDeletionImpact(
  id: string,
): Promise<CategoryDeletionImpact> {
  const hDoc = await householdDoc();
  const [txSnap, bdSnap, budgetSnap] = await Promise.all([
    getDocs(
      query(collection(hDoc, "transactions"), where("categoryId", "==", id)),
    ),
    getDocs(
      query(collection(hDoc, "breakdowns"), where("categoryId", "==", id)),
    ),
    getDoc(doc(collection(hDoc, "budgets"), id)),
  ]);
  return {
    transactionCount: excludeDeletedTransactionDocs(txSnap.docs).length,
    breakdownCount: bdSnap.size,
    hasBudget: snapshotExists(budgetSnap),
  };
}

export async function updateCategory(
  id: string,
  name: string,
  color: string,
): Promise<void> {
  const hDoc = await householdDoc();
  await updateDoc(doc(collection(hDoc, "categories"), id), {
    name,
    color,
    updatedAt: serverTimestamp(),
  });
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const hDoc = await householdDoc();
  const snap = await getDoc(doc(collection(hDoc, "categories"), id));
  const data = getSnapshotDataOrNull(snap);
  if (!data) return null;
  return mapCategory(snap.id, data);
}

// ── Breakdowns ───────────────────────────────────────

export async function getBreakdownsByCategory(
  categoryId: string,
): Promise<Breakdown[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(
    query(
      collection(hDoc, "breakdowns"),
      where("categoryId", "==", categoryId),
    ),
  );
  return sortBreakdownsForDisplay(
    snap.docs.map((doc) => mapBreakdown(doc.id, doc.data())),
  );
}

export async function getAllBreakdowns(): Promise<Breakdown[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(collection(hDoc, "breakdowns"));
  return sortBreakdownsForDisplay(
    snap.docs.map((doc) => mapBreakdown(doc.id, doc.data())),
  );
}

export async function addBreakdown(
  categoryId: string,
  name: string,
): Promise<string> {
  const hDoc = await householdDoc();
  const categoryBreakdownsSnap = await getDocs(
    query(
      collection(hDoc, "breakdowns"),
      where("categoryId", "==", categoryId),
    ),
  );
  const displayOrder = categoryBreakdownsSnap.docs.reduce((maxOrder, doc) => {
    const value = doc.data().displayOrder;
    return typeof value === "number" ? Math.max(maxOrder, value + 1) : maxOrder;
  }, categoryBreakdownsSnap.size);
  const ref = await addDoc(collection(hDoc, "breakdowns"), {
    categoryId,
    name,
    isDefault: false,
    displayOrder,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBreakdownDisplayOrders(
  breakdowns: Breakdown[],
): Promise<void> {
  const hDoc = await householdDoc();
  const patch = buildBreakdownDisplayOrderPatch(breakdowns);
  const ops: BatchOp[] = patch.map(
    (item) => (batch) =>
      batch.update(doc(collection(hDoc, "breakdowns"), item.id), {
        displayOrder: item.displayOrder,
        updatedAt: serverTimestamp(),
      }),
  );
  await commitBatchOps(ops);
}

export async function updateBreakdown(id: string, name: string): Promise<void> {
  const hDoc = await householdDoc();
  await updateDoc(doc(collection(hDoc, "breakdowns"), id), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBreakdown(id: string): Promise<void> {
  const hDoc = await householdDoc();
  const ops: BatchOp[] = [];

  const txSnap = await getDocs(
    query(collection(hDoc, "transactions"), where("breakdownId", "==", id)),
  );
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        breakdownId: null,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  ops.push((batch) => batch.delete(doc(collection(hDoc, "breakdowns"), id)));

  if (txSnap.size > 0) {
    ops.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(ops);
}

// ── Transactions ─────────────────────────────────────

export async function addTransaction(
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: string,
  accountId: string,
  memo: string,
  breakdownId?: string | null,
  storeId?: string | null,
  metadataInput?: TransactionWriteMetadataInput,
): Promise<string> {
  const hDoc = await householdDoc();

  const metadata = metadataInput
    ? buildTransactionWriteMetadata(metadataInput)
    : await Promise.all([
        resolveTransactionSnapshot(hDoc, categoryId, breakdownId),
        resolveAccountName(hDoc, accountId),
        resolveStoreName(hDoc, storeId),
      ]).then(([snapshot, accountName, storeName]) =>
        buildTransactionWriteMetadata({
          accountName,
          categoryName: snapshot.categoryName,
          categoryColor: snapshot.categoryColor,
          breakdownName: snapshot.breakdownName,
          storeName,
        }),
      );

  const txRef = doc(collection(hDoc, "transactions"));
  const batch = writeBatch(getFirestore());

  batch.set(txRef, {
    date,
    amount,
    type,
    accountId,
    categoryId,
    breakdownId: breakdownId ?? null,
    storeId: storeId ?? null,
    accountNameSnapshot: metadata.accountName,
    categoryNameSnapshot: metadata.categoryName,
    categoryColorSnapshot: metadata.categoryColor,
    breakdownNameSnapshot: metadata.breakdownName,
    storeNameSnapshot: metadata.storeName,
    memo,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: getCurrentUser()?.uid ?? "",
  });

  for (const adjustment of buildBalanceAdjustmentsForCreate({
    accountId,
    type,
    amount,
  })) {
    batch.update(doc(collection(hDoc, "accounts"), adjustment.accountId), {
      balance: increment(adjustment.delta),
      updatedAt: serverTimestamp(),
    });
  }

  // 店舗使用履歴
  if (storeId) {
    batch.update(doc(collection(hDoc, "stores"), storeId), {
      lastUsedAt: serverTimestamp(),
    });
    if (categoryId) {
      batch.set(
        doc(collection(hDoc, "storeCategoryUsage"), `${storeId}_${categoryId}`),
        {
          storeId,
          categoryId,
          lastUsedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  bumpDataVersionInBatch(batch, hDoc);

  await batch.commit();
  return txRef.id;
}

export type ImportTransactionRow = {
  date: string;
  amount: number;
  type: TransactionType;
  accountId: string | null;
  categoryId: string | null;
  breakdownId: string | null;
  storeId: string | null;
  memo: string;
  metadata: TransactionWriteMetadataInput;
};

/** CSVインポート用の一括書込。口座残高・店舗使用履歴は意図的に更新しない
 *  （残高は事後に既存の残高再計算機能で調整する前提）。
 *  onProgress はバッチコミットごとに（書込済件数, 総件数）で呼ばれる。 */
export async function importTransactions(
  rows: ImportTransactionRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const hDoc = await householdDoc();
  const uid = getCurrentUser()?.uid ?? "";
  const BATCH_LIMIT = 450;

  if (rows.length === 0) return 0;

  for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
    const chunk = rows.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(getFirestore());
    for (const row of chunk) {
      const metadata = buildTransactionWriteMetadata(row.metadata);
      batch.set(doc(collection(hDoc, "transactions")), {
        date: row.date,
        amount: row.amount,
        type: row.type,
        accountId: row.accountId,
        categoryId: row.categoryId,
        breakdownId: row.breakdownId,
        storeId: row.storeId,
        accountNameSnapshot: metadata.accountName,
        categoryNameSnapshot: metadata.categoryName,
        categoryColorSnapshot: metadata.categoryColor,
        breakdownNameSnapshot: metadata.breakdownName,
        storeNameSnapshot: metadata.storeName,
        memo: row.memo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });
    }
    if (start + BATCH_LIMIT >= rows.length) {
      bumpDataVersionInBatch(batch, hDoc);
    }
    await batch.commit();
    onProgress?.(Math.min(start + BATCH_LIMIT, rows.length), rows.length);
  }

  return rows.length;
}

export async function updateTransactionFromPrevious(
  previous: Transaction,
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: string,
  accountId: string,
  memo: string,
  breakdownId?: string | null,
  storeId?: string | null,
  metadataInput?: TransactionWriteMetadataInput,
): Promise<void> {
  const hDoc = await householdDoc();
  const metadata = metadataInput
    ? buildTransactionWriteMetadata(metadataInput)
    : await Promise.all([
        resolveTransactionSnapshot(hDoc, categoryId, breakdownId),
        resolveAccountName(hDoc, accountId),
        resolveStoreName(hDoc, storeId),
      ]).then(([snapshot, accountName, storeName]) =>
        buildTransactionWriteMetadata({
          accountName,
          categoryName: snapshot.categoryName,
          categoryColor: snapshot.categoryColor,
          breakdownName: snapshot.breakdownName,
          storeName,
        }),
      );
  const batch = writeBatch(getFirestore());

  batch.update(doc(collection(hDoc, "transactions"), previous.id), {
    date,
    amount,
    type,
    accountId,
    categoryId,
    breakdownId: breakdownId ?? null,
    storeId: storeId ?? null,
    accountNameSnapshot: metadata.accountName,
    categoryNameSnapshot: metadata.categoryName,
    categoryColorSnapshot: metadata.categoryColor,
    breakdownNameSnapshot: metadata.breakdownName,
    storeNameSnapshot: metadata.storeName,
    memo,
    updatedAt: serverTimestamp(),
  });

  for (const adjustment of buildBalanceAdjustmentsForUpdate(
    {
      accountId: previous.accountId || DEFAULT_ACCOUNT_ID,
      type: previous.type,
      amount: previous.amount,
    },
    { accountId, type, amount },
  )) {
    batch.update(doc(collection(hDoc, "accounts"), adjustment.accountId), {
      balance: increment(adjustment.delta),
      updatedAt: serverTimestamp(),
    });
  }

  if (storeId) {
    batch.update(doc(collection(hDoc, "stores"), storeId), {
      lastUsedAt: serverTimestamp(),
    });
    batch.set(
      doc(collection(hDoc, "storeCategoryUsage"), `${storeId}_${categoryId}`),
      {
        storeId,
        categoryId,
        lastUsedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  bumpDataVersionInBatch(batch, hDoc);

  await batch.commit();
}

/** 取引を削除する（ソフトデリート・オフライン対応版）。
 *  物理削除ではなく `deleted: true` + `updatedAt` 更新にすることで、
 *  updatedAt 差分クエリで削除も検知でき、ローカルキャッシュに幽霊データが
 *  残らない（issue #4 / ADR: transaction-soft-delete）。
 *  purposely 読み取りなしのバッチ書込のため二重削除ガードはない。
 *  呼び出し側UIが削除済み項目を即時に一覧から除くこと（従来と同じ前提）。 */
export async function deleteTransactionFromPrevious(
  previous: Transaction,
): Promise<void> {
  const hDoc = await householdDoc();
  const batch = writeBatch(getFirestore());

  batch.update(doc(collection(hDoc, "transactions"), previous.id), {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
  for (const adjustment of buildBalanceAdjustmentsForDelete({
    accountId: previous.accountId || DEFAULT_ACCOUNT_ID,
    type: previous.type,
    amount: previous.amount,
  })) {
    batch.update(doc(collection(hDoc, "accounts"), adjustment.accountId), {
      balance: increment(adjustment.delta),
      updatedAt: serverTimestamp(),
    });
  }

  bumpDataVersionInBatch(batch, hDoc);

  await batch.commit();
}

// ── Accounts ─────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(collection(hDoc, "accounts"));
  return snap.docs
    .map((doc) => mapAccount(doc.id, doc.data()))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      return a.id.localeCompare(b.id);
    });
}

export async function addAccount(
  name: string,
  balance: number,
): Promise<string> {
  const hDoc = await householdDoc();
  const ref = await addDoc(collection(hDoc, "accounts"), {
    name,
    balance,
    initialBalance: balance,
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccountName(
  id: string,
  name: string,
): Promise<void> {
  const hDoc = await householdDoc();
  const ops: BatchOp[] = [];

  ops.push((batch) =>
    batch.update(doc(collection(hDoc, "accounts"), id), {
      name,
      updatedAt: serverTimestamp(),
    }),
  );

  // スナップショット更新
  const txSnap = await getDocs(
    query(collection(hDoc, "transactions"), where("accountId", "==", id)),
  );
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        accountNameSnapshot: name,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  if (txSnap.size > 0) {
    ops.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(ops);
}

export async function updateAccountBalance(
  id: string,
  balance: number,
): Promise<void> {
  const hDoc = await householdDoc();

  // 残高は「手動設定＋登録/編集/削除の増分」のみで維持する方針（自動 reconcile 廃止）。
  // よって全取引を読んで純額から逆算する必要はなく、入力値をそのまま残高として保存する。
  // initialBalance は手動設定時点の残高として同値を保持する。
  // 読み取り値を使わない単純上書きのため runTransaction は使わない。トランザクションは
  // ローカルキャッシュに楽観反映されず、保存直後の再読込が旧値を返すため（issue #7）。
  // 同時編集は updateDoc でも last-write-wins となり、最終状態は変わらない。
  await updateDoc(doc(collection(hDoc, "accounts"), id), {
    balance,
    initialBalance: balance,
    updatedAt: serverTimestamp(),
  });
}

export async function reconcileAccountBalancesFromTransactions(): Promise<{
  initialized: number;
  corrected: number;
}> {
  const hDoc = await householdDoc();
  const [accountsSnap, transactionsSnap] = await Promise.all([
    getDocs(collection(hDoc, "accounts")),
    getDocs(collection(hDoc, "transactions")),
  ]);
  const patches = buildAccountBalanceReconciliation(
    accountsSnap.docs.map((doc) => mapAccount(doc.id, doc.data())),
    excludeDeletedTransactionDocs(transactionsSnap.docs).map((doc) => {
      const data = doc.data();
      return {
        accountId: data.accountId ?? DEFAULT_ACCOUNT_ID,
        type: data.type as TransactionType,
        amount: data.amount ?? 0,
      };
    }),
    DEFAULT_ACCOUNT_ID,
  );

  const ops: BatchOp[] = patches.map((patch) => (batch) => {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.initializeInitialBalance) {
      payload.initialBalance = patch.initialBalance;
    }
    if (patch.updateBalance) {
      payload.balance = patch.balance;
    }
    batch.update(doc(collection(hDoc, "accounts"), patch.accountId), payload);
  });
  await commitBatchOps(ops);

  return {
    initialized: patches.filter((patch) => patch.initializeInitialBalance)
      .length,
    corrected: patches.filter((patch) => patch.updateBalance).length,
  };
}

export async function deleteAccountAndMoveToDefault(id: string): Promise<void> {
  if (id === DEFAULT_ACCOUNT_ID) {
    throw new Error("既定口座は削除できません");
  }

  const hDoc = await householdDoc();
  const accountRef = doc(collection(hDoc, "accounts"), id);
  const accountSnap = await getDoc(accountRef);
  if (!snapshotExists(accountSnap)) return;

  // 既定口座名を取得
  const defaultAccountSnap = await getDoc(
    doc(collection(hDoc, "accounts"), DEFAULT_ACCOUNT_ID),
  );
  const defaultAccountName =
    defaultAccountSnap.data()?.name ?? DEFAULT_ACCOUNT_NAME;

  // 該当口座の取引を取得
  const txSnap = await getDocs(
    query(collection(hDoc, "transactions"), where("accountId", "==", id)),
  );

  // 純額を計算（ソフトデリート済みは残高を戻し済みのため除外する）
  let net = 0;
  for (const doc of excludeDeletedTransactionDocs(txSnap.docs)) {
    const data = doc.data();
    net += data.type === "income" ? data.amount : -data.amount;
  }

  const ops: BatchOp[] = [];

  // 取引を既定口座に移動
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        accountId: DEFAULT_ACCOUNT_ID,
        accountNameSnapshot: defaultAccountName,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  // 既定口座の残高に純額を加算
  if (net !== 0) {
    ops.push((batch) =>
      batch.update(doc(collection(hDoc, "accounts"), DEFAULT_ACCOUNT_ID), {
        balance: increment(net),
        updatedAt: serverTimestamp(),
      }),
    );
  }

  // 口座削除
  ops.push((batch) => batch.delete(accountRef));

  if (txSnap.size > 0) {
    ops.push((batch) => bumpDataVersionInBatch(batch, hDoc));
  }

  await commitBatchOps(ops);
}

// ── Stores ───────────────────────────────────────────

export async function getStoresByCategory(
  categoryId?: string | null,
): Promise<Store[]> {
  const hDoc = await householdDoc();
  const [storesSnap, usageSnap] = await Promise.all([
    getDocs(collection(hDoc, "stores")),
    categoryId
      ? getDocs(
          query(
            collection(hDoc, "storeCategoryUsage"),
            where("categoryId", "==", categoryId),
          ),
        )
      : Promise.resolve(null),
  ]);

  return buildStoreOptionsForCategory(
    storesSnap.docs.map((doc) => mapStore(doc.id, doc.data())),
    usageSnap?.docs.map((doc) => mapStoreCategoryUsage(doc.data())) ?? [],
    categoryId,
  );
}

export async function upsertStore(
  name: string,
  categoryId?: string | null,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("お店名を入力してください");
  }

  const hDoc = await householdDoc();
  const existing = await getDocs(
    query(collection(hDoc, "stores"), where("name", "==", trimmed), limit(1)),
  );

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const currentCategoryId = existingDoc.data().categoryId ?? null;
    await updateDoc(existingDoc.ref, {
      ...(currentCategoryId == null && categoryId != null
        ? { categoryId }
        : {}),
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (categoryId != null) {
      await setDoc(
        doc(
          collection(hDoc, "storeCategoryUsage"),
          `${existingDoc.id}_${categoryId}`,
        ),
        {
          storeId: existingDoc.id,
          categoryId,
          lastUsedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
    return existingDoc.id;
  }

  const ref = await addDoc(collection(hDoc, "stores"), {
    name: trimmed,
    categoryId: categoryId ?? null,
    lastUsedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (categoryId != null) {
    await setDoc(
      doc(collection(hDoc, "storeCategoryUsage"), `${ref.id}_${categoryId}`),
      {
        storeId: ref.id,
        categoryId,
        lastUsedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return ref.id;
}

export async function createStoreMasterWrite(
  name: string,
  categoryId?: string | null,
): Promise<{ storeId: string; pendingWrite: Promise<void> }> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("お店名を入力してください");
  }

  const hDoc = await householdDoc();
  const existingSnap = await getDocs(
    query(collection(hDoc, "stores"), where("name", "==", trimmed)),
  ).catch(() => null);
  const existingStore = findStoreByName(
    trimmed,
    existingSnap?.docs.map((doc) => mapStore(doc.id, doc.data())) ?? [],
  );
  const ref = existingStore
    ? doc(collection(hDoc, "stores"), existingStore.id)
    : doc(collection(hDoc, "stores"));
  const batch = writeBatch(getFirestore());

  if (existingStore) {
    batch.update(ref, {
      ...(existingStore.categoryId == null && categoryId != null
        ? { categoryId }
        : {}),
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(ref, {
      name: trimmed,
      categoryId: categoryId ?? null,
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (categoryId != null) {
    batch.set(
      doc(collection(hDoc, "storeCategoryUsage"), `${ref.id}_${categoryId}`),
      {
        storeId: ref.id,
        categoryId,
        lastUsedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return { storeId: ref.id, pendingWrite: batch.commit() };
}

// ── Queries ──────────────────────────────────────────

export async function getTransactionsByMonth(
  year: number,
  month: number,
): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const from = fromYearMonthDate(year, month);
  const to = toYearMonthDate(year, month);

  const snap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("date", ">=", from),
      where("date", "<=", to),
      orderBy("date", "desc"),
    ),
  );

  return mapActiveTransactions(snap.docs)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function getTransactionsByDate(
  date: string,
): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(
    query(collection(hDoc, "transactions"), where("date", "==", date)),
  );

  return mapActiveTransactions(snap.docs)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTransactionsByYear(
  year: number,
): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("date", ">=", `${year}-01-01`),
      where("date", "<=", `${year}-12-31`),
      orderBy("date", "desc"),
    ),
  );

  return mapActiveTransactions(snap.docs);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(collection(hDoc, "transactions"));

  return mapActiveTransactions(snap.docs)
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

// ── Budget / Aggregation ─────────────────────────────

export async function getMonthCategorySummary(
  year: number,
  month: number,
): Promise<MonthlyCategorySummary[]> {
  const hDoc = await householdDoc();
  const from = fromYearMonthDate(year, month);
  const to = toYearMonthDate(year, month);

  const snap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("date", ">=", from),
      where("date", "<=", to),
    ),
  );

  return buildMonthCategorySummaryFromTransactions(
    mapActiveTransactions(snap.docs),
    year,
    month,
  );
}

export async function setMonthlyBudget(
  categoryId: string,
  amount: number,
): Promise<void> {
  const hDoc = await householdDoc();
  await setDoc(
    doc(collection(hDoc, "budgets"), categoryId),
    {
      categoryId,
      amount,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteMonthlyBudget(categoryId: string): Promise<void> {
  const hDoc = await householdDoc();
  await deleteDoc(doc(collection(hDoc, "budgets"), categoryId));
}

export async function getMonthlyBudgets(
  type: TransactionType = "expense",
): Promise<MonthlyBudget[]> {
  const hDoc = await householdDoc();

  const [categoriesSnap, budgetsSnap] = await Promise.all([
    getDocs(query(collection(hDoc, "categories"), where("type", "==", type))),
    getDocs(collection(hDoc, "budgets")),
  ]);

  const budgetMap = new Map<string, number>();
  for (const doc of budgetsSnap.docs) {
    budgetMap.set(doc.id, doc.data().amount);
  }

  return categoriesSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        categoryId: doc.id,
        categoryName: data.name,
        categoryColor: data.color,
        amount: budgetMap.get(doc.id) ?? 0,
        _isDefault: !!data.isDefault,
      };
    })
    .sort((a, b) => {
      if (a._isDefault !== b._isDefault)
        return (b._isDefault ? 1 : 0) - (a._isDefault ? 1 : 0);
      return a.categoryName.localeCompare(b.categoryName);
    })
    .map(({ _isDefault, ...rest }) => rest);
}

export async function getMonthBudgetStatuses(
  year: number,
  month: number,
): Promise<BudgetStatus[]> {
  const hDoc = await householdDoc();
  const from = fromYearMonthDate(year, month);
  const to = toYearMonthDate(year, month);

  const [budgetsSnap, categoriesSnap, txSnap] = await Promise.all([
    getDocs(collection(hDoc, "budgets")),
    getDocs(
      query(collection(hDoc, "categories"), where("type", "==", "expense")),
    ),
    getDocs(
      query(
        collection(hDoc, "transactions"),
        where("date", ">=", from),
        where("date", "<=", to),
      ),
    ),
  ]);

  return buildBudgetStatusesFromData({
    year,
    month,
    transactions: mapActiveTransactions(txSnap.docs),
    budgets: budgetsSnap.docs.map((doc) =>
      mapBudgetDefinition(doc.id, doc.data()),
    ),
    categories: categoriesSnap.docs.map((doc) =>
      mapCategory(doc.id, doc.data()),
    ),
    fromCache:
      budgetsSnap.metadata.fromCache ||
      categoriesSnap.metadata.fromCache ||
      txSnap.metadata.fromCache,
  });
}

export async function getBudgetStatusForDate(
  date: string,
  categoryId: string,
): Promise<BudgetStatus | null> {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;

  const hDoc = await householdDoc();

  const categorySnap = await getDoc(
    doc(collection(hDoc, "categories"), categoryId),
  );
  const catData = getSnapshotDataOrNull(categorySnap);
  if (!catData) return null;
  if (catData.type !== "expense") return null;

  const budgetSnap = await getDoc(doc(collection(hDoc, "budgets"), categoryId));
  const budgetData = getSnapshotDataOrNull(budgetSnap);
  if (!budgetData) return null;
  const budgetAmount = budgetData.amount;
  if (budgetAmount <= 0) return null;

  const from = fromYearMonthDate(year, month);
  const to = toYearMonthDate(year, month);

  const txSnap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("categoryId", "==", categoryId),
      where("date", ">=", from),
      where("date", "<=", to),
    ),
  );

  let spentAmount = 0;
  for (const doc of excludeDeletedTransactionDocs(txSnap.docs)) {
    const data = doc.data();
    if (data.type === "expense") spentAmount += data.amount;
  }

  const usageRate = spentAmount / budgetAmount;
  const level: BudgetAlertLevel =
    usageRate >= 1 ? "exceeded" : usageRate >= 0.8 ? "warning" : "none";
  const fromCache =
    categorySnap.metadata.fromCache ||
    budgetSnap.metadata.fromCache ||
    txSnap.metadata.fromCache;

  return {
    categoryId,
    categoryName: catData.name,
    categoryColor: catData.color,
    budgetAmount,
    spentAmount,
    usageRate,
    level,
    fromCache,
  };
}

export async function getYearMonthlyTotals(
  year: number,
): Promise<MonthlyTotal[]> {
  const hDoc = await householdDoc();
  const snap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("date", ">=", `${year}-01-01`),
      where("date", "<=", `${year}-12-31`),
    ),
  );

  return buildYearMonthlyTotalsFromTransactions(
    mapActiveTransactions(snap.docs),
    year,
  );
}

export async function getDatesWithTransactions(
  year: number,
  month: number,
): Promise<string[]> {
  const hDoc = await householdDoc();
  const from = fromYearMonthDate(year, month);
  const to = toYearMonthDate(year, month);

  const snap = await getDocs(
    query(
      collection(hDoc, "transactions"),
      where("date", ">=", from),
      where("date", "<=", to),
    ),
  );

  const dates = new Set<string>();
  for (const doc of excludeDeletedTransactionDocs(snap.docs)) {
    dates.add(doc.data().date);
  }
  return Array.from(dates);
}
