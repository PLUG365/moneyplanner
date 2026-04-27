import firestore, {
    FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { getHouseholdDeletionCollectionNames } from "./accountDeletion";
import { getCurrentUser } from "./auth";
import { getSnapshotDataOrNull, snapshotExists } from "./firestoreSnapshot";
import { getHouseholdId } from "./household";
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

// ── 定数 ──────────────────────────────────────────────
export const DEFAULT_ACCOUNT_ID = "default";
export const DEFAULT_ACCOUNT_NAME = "家計";

// ── 型定義（Firestore 版: ID は string）──────────────
export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  isDefault: boolean;
}

export interface Breakdown {
  id: string;
  categoryId: string;
  name: string;
  isDefault: boolean;
}

export interface Store {
  id: string;
  name: string;
  categoryId: string | null;
  lastUsedAt: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  accountId: string;
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

export interface PlanLifeEvent {
  id: string;
  eventType: string;
  paramsJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanProfile {
  payloadJson: string;
  updatedAt: string;
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
  return firestore().collection("households").doc(hid);
}

export function householdCollection(
  householdId: string,
  collectionName: string,
): FirebaseFirestoreTypes.CollectionReference {
  return firestore()
    .collection("households")
    .doc(householdId)
    .collection(collectionName);
}

function toISOString(
  ts: FirebaseFirestoreTypes.Timestamp | null | undefined,
): string {
  if (!ts) return new Date().toISOString();
  return ts.toDate().toISOString();
}

type BatchOp = (batch: FirebaseFirestoreTypes.WriteBatch) => void;

async function commitBatchOps(ops: BatchOp[]): Promise<void> {
  const LIMIT = 499;
  for (let i = 0; i < ops.length; i += LIMIT) {
    const batch = firestore().batch();
    const chunk = ops.slice(i, i + LIMIT);
    for (const op of chunk) op(batch);
    await batch.commit();
  }
}

async function deleteCollectionDocs(
  collectionRef: FirebaseFirestoreTypes.CollectionReference,
): Promise<void> {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return;
  const ops: BatchOp[] = snapshot.docs.map(
    (doc) => (batch) => batch.delete(doc.ref),
  );
  await commitBatchOps(ops);
}

async function deleteHouseholdDocAndMembers(
  hDoc: FirebaseFirestoreTypes.DocumentReference,
): Promise<void> {
  const membersSnap = await hDoc.collection("members").get();
  const batch = firestore().batch();
  batch.delete(hDoc);
  membersSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function resolveTransactionSnapshot(
  hDoc: FirebaseFirestoreTypes.DocumentReference,
  categoryId: string,
  breakdownId?: string | null,
): Promise<{
  categoryName: string;
  categoryColor: string;
  breakdownName: string;
}> {
  const categoryPromise = hDoc.collection("categories").doc(categoryId).get();
  const breakdownPromise = breakdownId
    ? hDoc.collection("breakdowns").doc(breakdownId).get()
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
  hDoc: FirebaseFirestoreTypes.DocumentReference,
  accountId: string,
): Promise<string> {
  const snap = await hDoc.collection("accounts").doc(accountId).get();
  return snap.data()?.name ?? DEFAULT_ACCOUNT_NAME;
}

async function resolveStoreName(
  hDoc: FirebaseFirestoreTypes.DocumentReference,
  storeId?: string | null,
): Promise<string> {
  if (!storeId) return "";
  const snap = await hDoc.collection("stores").doc(storeId).get();
  return snap.data()?.name ?? "";
}

// ── マッピング ───────────────────────────────────────
export function mapCategory(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): Category {
  return {
    id,
    name: data.name,
    type: data.type as TransactionType,
    color: data.color,
    isDefault: !!data.isDefault,
  };
}

export function mapBreakdown(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): Breakdown {
  return {
    id,
    categoryId: data.categoryId,
    name: data.name,
    isDefault: !!data.isDefault,
  };
}

export function mapTransaction(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): Transaction {
  return {
    id,
    date: data.date,
    amount: data.amount,
    type: data.type as TransactionType,
    accountId: data.accountId ?? DEFAULT_ACCOUNT_ID,
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

export function mapAccount(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): Account {
  return {
    id,
    name: data.name,
    balance: data.balance ?? 0,
    isDefault: !!data.isDefault,
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
  };
}

export function mapBudgetDefinition(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): BudgetDefinition {
  return {
    categoryId: data.categoryId ?? id,
    amount: data.amount ?? 0,
  };
}

function mapStore(
  id: string,
  data: FirebaseFirestoreTypes.DocumentData,
): Store {
  return {
    id,
    name: data.name,
    categoryId: data.categoryId ?? null,
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
  { name: "立替金返済", type: "expense", color: "#F9A825", breakdowns: [] },
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

  const categoriesSnap = await hDoc.collection("categories").limit(1).get();
  if (!categoriesSnap.empty) return;

  const batch = firestore().batch();

  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = hDoc.collection("categories").doc();
    batch.set(catRef, {
      name: cat.name,
      type: cat.type,
      color: cat.color,
      isDefault: true,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    for (const breakdownName of cat.breakdowns) {
      const bdRef = hDoc.collection("breakdowns").doc();
      batch.set(bdRef, {
        categoryId: catRef.id,
        name: breakdownName,
        isDefault: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  batch.set(hDoc.collection("accounts").doc(DEFAULT_ACCOUNT_ID), {
    name: DEFAULT_ACCOUNT_NAME,
    balance: 0,
    isDefault: true,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
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
    "planLifeEvents",
    "planProfile",
    "stores",
    "storeCategoryUsage",
    "breakdowns",
    "categories",
  ];

  for (const name of collections) {
    await deleteCollectionDocs(hDoc.collection(name));
  }

  // 再初期化
  const batch = firestore().batch();
  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = hDoc.collection("categories").doc();
    batch.set(catRef, {
      name: cat.name,
      type: cat.type,
      color: cat.color,
      isDefault: true,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    for (const breakdownName of cat.breakdowns) {
      batch.set(hDoc.collection("breakdowns").doc(), {
        categoryId: catRef.id,
        name: breakdownName,
        isDefault: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }
  batch.set(hDoc.collection("accounts").doc(DEFAULT_ACCOUNT_ID), {
    name: DEFAULT_ACCOUNT_NAME,
    balance: 0,
    isDefault: true,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function deleteHouseholdDataAndCurrentUserProfile(): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("ログインしていません");
  }

  const householdId = await ensureHouseholdId();
  const hDoc = firestore().collection("households").doc(householdId);
  const householdSnap = await hDoc.get();
  const inviteCode = householdSnap.data()?.inviteCode as string | undefined;

  if (inviteCode) {
    await firestore().collection("inviteCodes").doc(inviteCode).delete();
  }

  const collectionNames = getHouseholdDeletionCollectionNames();
  for (const name of collectionNames.filter((item) => item !== "members")) {
    await deleteCollectionDocs(hDoc.collection(name));
  }

  await deleteHouseholdDocAndMembers(hDoc);
  await firestore().collection("users").doc(user.uid).delete();
  clearHouseholdCache();
}

export async function resetCategoryAndBreakdownsToDefault(): Promise<void> {
  const hDoc = await householdDoc();

  // トランザクションのカテゴリ参照を NULL に
  const txSnap = await hDoc.collection("transactions").get();
  const ops: BatchOp[] = txSnap.docs.map(
    (doc) => (batch) =>
      batch.update(doc.ref, {
        categoryId: null,
        breakdownId: null,
        storeId: null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
  );
  await commitBatchOps(ops);

  // 関連コレクション削除
  for (const name of [
    "budgets",
    "planLifeEvents",
    "planProfile",
    "stores",
    "storeCategoryUsage",
    "breakdowns",
    "categories",
  ]) {
    await deleteCollectionDocs(hDoc.collection(name));
  }

  // デフォルトカテゴリ再投入
  const batch = firestore().batch();
  for (const cat of DEFAULT_CATEGORIES) {
    const catRef = hDoc.collection("categories").doc();
    batch.set(catRef, {
      name: cat.name,
      type: cat.type,
      color: cat.color,
      isDefault: true,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    for (const breakdownName of cat.breakdowns) {
      batch.set(hDoc.collection("breakdowns").doc(), {
        categoryId: catRef.id,
        name: breakdownName,
        isDefault: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

// ── Categories ───────────────────────────────────────

export async function getCategories(
  type?: TransactionType,
): Promise<Category[]> {
  const hDoc = await householdDoc();
  let query: FirebaseFirestoreTypes.Query = hDoc.collection("categories");
  if (type) {
    query = query.where("type", "==", type);
  }
  const snap = await query.get();
  return snap.docs
    .map((doc) => mapCategory(doc.id, doc.data()))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export async function addCategory(
  name: string,
  type: TransactionType,
  color: string,
): Promise<string> {
  const hDoc = await householdDoc();
  const ref = await hDoc.collection("categories").add({
    name,
    type,
    color,
    isDefault: false,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCategory(id: string): Promise<void> {
  const hDoc = await householdDoc();
  const ops: BatchOp[] = [];

  // トランザクション更新
  const txSnap = await hDoc
    .collection("transactions")
    .where("categoryId", "==", id)
    .get();
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        categoryId: null,
        breakdownId: null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  // 予算削除
  ops.push((batch) => batch.delete(hDoc.collection("budgets").doc(id)));

  // 内訳削除
  const bdSnap = await hDoc
    .collection("breakdowns")
    .where("categoryId", "==", id)
    .get();
  for (const doc of bdSnap.docs) {
    ops.push((batch) => batch.delete(doc.ref));
  }

  // カテゴリ削除
  ops.push((batch) => batch.delete(hDoc.collection("categories").doc(id)));

  await commitBatchOps(ops);
}

export async function updateCategory(
  id: string,
  name: string,
  color: string,
): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("categories").doc(id).update({
    name,
    color,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("categories").doc(id).get();
  const data = getSnapshotDataOrNull(snap);
  if (!data) return null;
  return mapCategory(snap.id, data);
}

// ── Breakdowns ───────────────────────────────────────

export async function getBreakdownsByCategory(
  categoryId: string,
): Promise<Breakdown[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc
    .collection("breakdowns")
    .where("categoryId", "==", categoryId)
    .get();
  return snap.docs
    .map((doc) => mapBreakdown(doc.id, doc.data()))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export async function addBreakdown(
  categoryId: string,
  name: string,
): Promise<string> {
  const hDoc = await householdDoc();
  const ref = await hDoc.collection("breakdowns").add({
    categoryId,
    name,
    isDefault: false,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateBreakdown(id: string, name: string): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("breakdowns").doc(id).update({
    name,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteBreakdown(id: string): Promise<void> {
  const hDoc = await householdDoc();
  const ops: BatchOp[] = [];

  const txSnap = await hDoc
    .collection("transactions")
    .where("breakdownId", "==", id)
    .get();
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        breakdownId: null,
        breakdownNameSnapshot: "",
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  ops.push((batch) => batch.delete(hDoc.collection("breakdowns").doc(id)));

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
): Promise<string> {
  const hDoc = await householdDoc();

  const [snapshot, accountName, storeName] = await Promise.all([
    resolveTransactionSnapshot(hDoc, categoryId, breakdownId),
    resolveAccountName(hDoc, accountId),
    resolveStoreName(hDoc, storeId),
  ]);

  const txRef = hDoc.collection("transactions").doc();
  const batch = firestore().batch();

  batch.set(txRef, {
    date,
    amount,
    type,
    accountId,
    categoryId,
    breakdownId: breakdownId ?? null,
    storeId: storeId ?? null,
    accountNameSnapshot: accountName,
    categoryNameSnapshot: snapshot.categoryName,
    categoryColorSnapshot: snapshot.categoryColor,
    breakdownNameSnapshot: snapshot.breakdownName,
    storeNameSnapshot: storeName,
    memo,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    createdBy: getCurrentUser()?.uid ?? "",
  });

  for (const adjustment of buildBalanceAdjustmentsForCreate({
    accountId,
    type,
    amount,
  })) {
    batch.update(hDoc.collection("accounts").doc(adjustment.accountId), {
      balance: firestore.FieldValue.increment(adjustment.delta),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }

  // 店舗使用履歴
  if (storeId) {
    batch.update(hDoc.collection("stores").doc(storeId), {
      lastUsedAt: firestore.FieldValue.serverTimestamp(),
    });
    if (categoryId) {
      batch.set(
        hDoc.collection("storeCategoryUsage").doc(`${storeId}_${categoryId}`),
        {
          storeId,
          categoryId,
          lastUsedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  await batch.commit();
  return txRef.id;
}

export async function updateTransaction(
  id: string,
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: string,
  accountId: string,
  memo: string,
  breakdownId?: string | null,
  storeId?: string | null,
): Promise<void> {
  const hDoc = await householdDoc();
  const txRef = hDoc.collection("transactions").doc(id);

  const [snapshot, accountName, storeName] = await Promise.all([
    resolveTransactionSnapshot(hDoc, categoryId, breakdownId),
    resolveAccountName(hDoc, accountId),
    resolveStoreName(hDoc, storeId),
  ]);

  await firestore().runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(txRef);
    if (!snapshotExists(currentSnap)) return;
    const current = currentSnap.data()!;

    transaction.update(txRef, {
      date,
      amount,
      type,
      accountId,
      categoryId,
      breakdownId: breakdownId ?? null,
      storeId: storeId ?? null,
      accountNameSnapshot: accountName,
      categoryNameSnapshot: snapshot.categoryName,
      categoryColorSnapshot: snapshot.categoryColor,
      breakdownNameSnapshot: snapshot.breakdownName,
      storeNameSnapshot: storeName,
      memo,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    for (const adjustment of buildBalanceAdjustmentsForUpdate(
      {
        accountId: current.accountId || DEFAULT_ACCOUNT_ID,
        type: current.type as TransactionType,
        amount: current.amount,
      },
      { accountId, type, amount },
    )) {
      transaction.update(
        hDoc.collection("accounts").doc(adjustment.accountId),
        {
          balance: firestore.FieldValue.increment(adjustment.delta),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      );
    }

    if (storeId) {
      transaction.update(hDoc.collection("stores").doc(storeId), {
        lastUsedAt: firestore.FieldValue.serverTimestamp(),
      });
      if (categoryId) {
        transaction.set(
          hDoc.collection("storeCategoryUsage").doc(`${storeId}_${categoryId}`),
          {
            storeId,
            categoryId,
            lastUsedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const hDoc = await householdDoc();
  const txRef = hDoc.collection("transactions").doc(id);

  await firestore().runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(txRef);
    if (!snapshotExists(currentSnap)) return;
    const current = currentSnap.data()!;

    transaction.delete(txRef);
    for (const adjustment of buildBalanceAdjustmentsForDelete({
      accountId: current.accountId || DEFAULT_ACCOUNT_ID,
      type: current.type as TransactionType,
      amount: current.amount,
    })) {
      transaction.update(
        hDoc.collection("accounts").doc(adjustment.accountId),
        {
          balance: firestore.FieldValue.increment(adjustment.delta),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
      );
    }
  });
}

// ── Accounts ─────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("accounts").get();
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
  const ref = await hDoc.collection("accounts").add({
    name,
    balance,
    isDefault: false,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
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
    batch.update(hDoc.collection("accounts").doc(id), {
      name,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    }),
  );

  // スナップショット更新
  const txSnap = await hDoc
    .collection("transactions")
    .where("accountId", "==", id)
    .get();
  for (const doc of txSnap.docs) {
    ops.push((batch) =>
      batch.update(doc.ref, {
        accountNameSnapshot: name,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  await commitBatchOps(ops);
}

export async function updateAccountBalance(
  id: string,
  balance: number,
): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("accounts").doc(id).update({
    balance,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteAccountAndMoveToDefault(id: string): Promise<void> {
  if (id === DEFAULT_ACCOUNT_ID) {
    throw new Error("既定口座は削除できません");
  }

  const hDoc = await householdDoc();
  const accountRef = hDoc.collection("accounts").doc(id);
  const accountSnap = await accountRef.get();
  if (!snapshotExists(accountSnap)) return;

  // 既定口座名を取得
  const defaultAccountSnap = await hDoc
    .collection("accounts")
    .doc(DEFAULT_ACCOUNT_ID)
    .get();
  const defaultAccountName =
    defaultAccountSnap.data()?.name ?? DEFAULT_ACCOUNT_NAME;

  // 該当口座の取引を取得
  const txSnap = await hDoc
    .collection("transactions")
    .where("accountId", "==", id)
    .get();

  // 純額を計算
  let net = 0;
  for (const doc of txSnap.docs) {
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
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  // 既定口座の残高に純額を加算
  if (net !== 0) {
    ops.push((batch) =>
      batch.update(hDoc.collection("accounts").doc(DEFAULT_ACCOUNT_ID), {
        balance: firestore.FieldValue.increment(net),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  // 口座削除
  ops.push((batch) => batch.delete(accountRef));

  await commitBatchOps(ops);
}

// ── Stores ───────────────────────────────────────────

export async function getStoresByCategory(
  categoryId?: string | null,
): Promise<Store[]> {
  const hDoc = await householdDoc();
  const storesSnap = await hDoc.collection("stores").get();
  const stores = storesSnap.docs.map((doc) => mapStore(doc.id, doc.data()));

  if (categoryId == null) {
    return stores.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  }

  // カテゴリ別使用履歴で並べ替え
  const usageSnap = await hDoc
    .collection("storeCategoryUsage")
    .where("categoryId", "==", categoryId)
    .get();
  const usageMap = new Map<string, string>();
  for (const doc of usageSnap.docs) {
    usageMap.set(doc.data().storeId, toISOString(doc.data().lastUsedAt));
  }

  return stores.sort((a, b) => {
    const aUsage = usageMap.get(a.id);
    const bUsage = usageMap.get(b.id);
    if (aUsage && !bUsage) return -1;
    if (!aUsage && bUsage) return 1;
    if (aUsage && bUsage) return bUsage.localeCompare(aUsage);
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  });
}

export async function getAllStores(): Promise<Store[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("stores").get();
  return snap.docs
    .map((doc) => mapStore(doc.id, doc.data()))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export async function upsertStore(
  name: string,
  categoryId?: string | null,
): Promise<string> {
  const hDoc = await householdDoc();
  const existing = await hDoc
    .collection("stores")
    .where("name", "==", name)
    .limit(1)
    .get();

  if (existing.empty) {
    const ref = await hDoc.collection("stores").add({
      name,
      categoryId: categoryId ?? null,
      lastUsedAt: firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  const doc = existing.docs[0];
  if (categoryId != null && doc.data().categoryId == null) {
    await doc.ref.update({ categoryId });
  }
  return doc.id;
}

// ── Life Events ──────────────────────────────────────

export async function addLifeEvent(
  eventType: string,
  paramsJson: string,
): Promise<string> {
  const hDoc = await householdDoc();
  const ref = await hDoc.collection("planLifeEvents").add({
    eventType,
    paramsJson,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateLifeEvent(
  id: string,
  paramsJson: string,
): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("planLifeEvents").doc(id).update({
    paramsJson,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteLifeEvent(id: string): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("planLifeEvents").doc(id).delete();
}

export async function getLifeEvents(): Promise<PlanLifeEvent[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("planLifeEvents").get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventType: data.eventType,
        paramsJson: data.paramsJson,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt),
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ── Plan Profile ─────────────────────────────────────

export async function getPlanProfile(): Promise<PlanProfile | null> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("planProfile").doc("default").get();
  const data = getSnapshotDataOrNull(snap);
  if (!data) return null;
  return {
    payloadJson: data.payloadJson,
    updatedAt: toISOString(data.updatedAt),
  };
}

export async function savePlanProfile(payloadJson: string): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("planProfile").doc("default").set({
    payloadJson,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

// ── Queries ──────────────────────────────────────────

export async function getTransactionsByMonth(
  year: number,
  month: number,
): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const snap = await hDoc
    .collection("transactions")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .orderBy("date", "desc")
    .get();

  return snap.docs
    .map((doc) => mapTransaction(doc.id, doc.data()))
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
  const snap = await hDoc
    .collection("transactions")
    .where("date", "==", date)
    .get();

  return snap.docs
    .map((doc) => mapTransaction(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTransactionsByYear(
  year: number,
): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc
    .collection("transactions")
    .where("date", ">=", `${year}-01-01`)
    .where("date", "<=", `${year}-12-31`)
    .orderBy("date", "desc")
    .get();

  return snap.docs.map((doc) => mapTransaction(doc.id, doc.data()));
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc.collection("transactions").get();

  return snap.docs
    .map((doc) => mapTransaction(doc.id, doc.data()))
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
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const snap = await hDoc
    .collection("transactions")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  return buildMonthCategorySummaryFromTransactions(
    snap.docs.map((doc) => mapTransaction(doc.id, doc.data())),
    year,
    month,
  );
}

export async function setMonthlyBudget(
  categoryId: string,
  amount: number,
): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("budgets").doc(categoryId).set(
    {
      categoryId,
      amount,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteMonthlyBudget(categoryId: string): Promise<void> {
  const hDoc = await householdDoc();
  await hDoc.collection("budgets").doc(categoryId).delete();
}

export async function getMonthlyBudgets(
  type: TransactionType = "expense",
): Promise<MonthlyBudget[]> {
  const hDoc = await householdDoc();

  const [categoriesSnap, budgetsSnap] = await Promise.all([
    hDoc.collection("categories").where("type", "==", type).get(),
    hDoc.collection("budgets").get(),
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
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const [budgetsSnap, categoriesSnap, txSnap] = await Promise.all([
    hDoc.collection("budgets").get(),
    hDoc.collection("categories").where("type", "==", "expense").get(),
    hDoc
      .collection("transactions")
      .where("date", ">=", from)
      .where("date", "<=", to)
      .get(),
  ]);

  return buildBudgetStatusesFromData({
    year,
    month,
    transactions: txSnap.docs.map((doc) => mapTransaction(doc.id, doc.data())),
    budgets: budgetsSnap.docs.map((doc) =>
      mapBudgetDefinition(doc.id, doc.data()),
    ),
    categories: categoriesSnap.docs.map((doc) =>
      mapCategory(doc.id, doc.data()),
    ),
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

  const categorySnap = await hDoc
    .collection("categories")
    .doc(categoryId)
    .get();
  const catData = getSnapshotDataOrNull(categorySnap);
  if (!catData) return null;
  if (catData.type !== "expense") return null;

  const budgetSnap = await hDoc.collection("budgets").doc(categoryId).get();
  const budgetData = getSnapshotDataOrNull(budgetSnap);
  if (!budgetData) return null;
  const budgetAmount = budgetData.amount;
  if (budgetAmount <= 0) return null;

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const txSnap = await hDoc
    .collection("transactions")
    .where("categoryId", "==", categoryId)
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  let spentAmount = 0;
  for (const doc of txSnap.docs) {
    const data = doc.data();
    if (data.type === "expense") spentAmount += data.amount;
  }

  const usageRate = spentAmount / budgetAmount;
  const level: BudgetAlertLevel =
    usageRate >= 1 ? "exceeded" : usageRate >= 0.8 ? "warning" : "none";

  return {
    categoryId,
    categoryName: catData.name,
    categoryColor: catData.color,
    budgetAmount,
    spentAmount,
    usageRate,
    level,
  };
}

export async function getYearMonthlyTotals(
  year: number,
): Promise<MonthlyTotal[]> {
  const hDoc = await householdDoc();
  const snap = await hDoc
    .collection("transactions")
    .where("date", ">=", `${year}-01-01`)
    .where("date", "<=", `${year}-12-31`)
    .get();

  return buildYearMonthlyTotalsFromTransactions(
    snap.docs.map((doc) => mapTransaction(doc.id, doc.data())),
    year,
  );
}

export async function getDatesWithTransactions(
  year: number,
  month: number,
): Promise<string[]> {
  const hDoc = await householdDoc();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const snap = await hDoc
    .collection("transactions")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  const dates = new Set<string>();
  for (const doc of snap.docs) {
    dates.add(doc.data().date);
  }
  return Array.from(dates);
}
