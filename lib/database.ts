import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("moneyplanner.db");

export type TransactionType = "income" | "expense";

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  color: string;
  isDefault: boolean;
}

export interface Breakdown {
  id: number;
  categoryId: number;
  name: string;
  isDefault: boolean;
}

export interface Store {
  id: number;
  name: string;
  categoryId: number;
  lastUsedAt: string;
}

export interface MonthlyBudget {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  amount: number;
}

export type BudgetAlertLevel = "none" | "warning" | "exceeded";

export interface BudgetStatus {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  budgetAmount: number;
  spentAmount: number;
  usageRate: number;
  level: BudgetAlertLevel;
}

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  type: TransactionType;
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  breakdownId: number | null;
  breakdownName: string;
  storeId: number | null;
  storeName: string;
  memo: string;
  createdAt: string;
}

export interface PlanLifeEvent {
  id: number;
  eventType: string;
  paramsJson: string;
  createdAt: string;
  updatedAt: string;
}

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

function columnExists(tableName: string, columnName: string): boolean {
  const columns = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );
  return columns.some((c) => c.name === columnName);
}

function ensureDefaultCategories() {
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = db.getFirstSync<{ id: number }>(
      "SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1",
      [cat.name, cat.type],
    );

    let categoryId = existing?.id;
    if (!categoryId) {
      const result = db.runSync(
        "INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 1)",
        [cat.name, cat.type, cat.color],
      );
      categoryId = result.lastInsertRowId;
    }

    for (const breakdownName of cat.breakdowns) {
      const existingBreakdown = db.getFirstSync<{ id: number }>(
        "SELECT id FROM category_breakdowns WHERE category_id = ? AND name = ? LIMIT 1",
        [categoryId, breakdownName],
      );
      if (!existingBreakdown) {
        db.runSync(
          "INSERT INTO category_breakdowns (category_id, name, is_default) VALUES (?, ?, 1)",
          [categoryId, breakdownName],
        );
      }
    }
  }
}

export function initDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#666666',
      is_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      breakdown_id INTEGER REFERENCES category_breakdowns(id),
      category_name_snapshot TEXT NOT NULL DEFAULT '',
      category_color_snapshot TEXT NOT NULL DEFAULT '#666666',
      breakdown_name_snapshot TEXT NOT NULL DEFAULT '',
      memo TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS category_breakdowns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      amount INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(year, month, category_id)
    );
    CREATE TABLE IF NOT EXISTS plan_life_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      params_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      last_used_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(name, category_id)
    );
  `);

  if (!columnExists("transactions", "breakdown_id")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN breakdown_id INTEGER REFERENCES category_breakdowns(id)",
    );
  }
  if (!columnExists("transactions", "category_name_snapshot")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN category_name_snapshot TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!columnExists("transactions", "category_color_snapshot")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN category_color_snapshot TEXT NOT NULL DEFAULT '#666666'",
    );
  }
  if (!columnExists("transactions", "breakdown_name_snapshot")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN breakdown_name_snapshot TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!columnExists("transactions", "store_id")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN store_id INTEGER REFERENCES stores(id)",
    );
  }
  if (!columnExists("transactions", "store_name_snapshot")) {
    db.runSync(
      "ALTER TABLE transactions ADD COLUMN store_name_snapshot TEXT NOT NULL DEFAULT ''",
    );
  }

  // 旧仕様（年+月/年無関係+月）を、カテゴリ単位の共通予算（year=0, month=0）へ統合する。
  db.runSync(
    `INSERT INTO budgets (year, month, category_id, amount, created_at, updated_at)
     SELECT 0, 0, b.category_id, b.amount, b.created_at, b.updated_at
     FROM budgets b
     WHERE NOT EXISTS (
       SELECT 1
       FROM budgets newer
       WHERE newer.category_id = b.category_id
         AND (
           newer.updated_at > b.updated_at
           OR (newer.updated_at = b.updated_at AND newer.id > b.id)
         )
     )
     ON CONFLICT(year, month, category_id)
     DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
  );
  db.runSync("DELETE FROM budgets WHERE NOT (year = 0 AND month = 0)");

  ensureDefaultCategories();

  const incomeCount = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE type = ?",
    ["income"],
  );
  if ((incomeCount?.count ?? 0) === 0) {
    db.runSync(
      "INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 1)",
      ["給与所得", "income", "#1565C0"],
    );
  }

  const expenseCount = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories WHERE type = ?",
    ["expense"],
  );
  if ((expenseCount?.count ?? 0) === 0) {
    db.runSync(
      "INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 1)",
      ["その他", "expense", "#757575"],
    );
  }

  db.runSync(
    `UPDATE transactions
     SET category_name_snapshot = COALESCE(
       NULLIF(category_name_snapshot, ''),
       (SELECT name FROM categories WHERE categories.id = transactions.category_id),
       '未分類'
     ),
     category_color_snapshot = COALESCE(
       NULLIF(category_color_snapshot, ''),
       (SELECT color FROM categories WHERE categories.id = transactions.category_id),
       '#666666'
     ),
     breakdown_name_snapshot = COALESCE(
       NULLIF(breakdown_name_snapshot, ''),
       (SELECT name FROM category_breakdowns WHERE category_breakdowns.id = transactions.breakdown_id),
       ''
     ),
     store_name_snapshot = COALESCE(
       NULLIF(store_name_snapshot, ''),
       (SELECT name FROM stores WHERE stores.id = transactions.store_id),
       ''
     )`,
  );
}

export function resetDatabaseForDevelopment() {
  if (!__DEV__) {
    throw new Error("DBリセットは開発環境でのみ実行できます");
  }

  db.execSync(`
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM plan_life_events;
    DELETE FROM stores;
    DELETE FROM category_breakdowns;
    DELETE FROM categories;
    DELETE FROM sqlite_sequence
    WHERE name IN ('transactions', 'budgets', 'plan_life_events', 'stores', 'category_breakdowns', 'categories');
  `);

  ensureDefaultCategories();
}

export function resetCategoryAndBreakdownsToDefault() {
  db.execSync(`
    UPDATE transactions SET category_id = NULL, breakdown_id = NULL, store_id = NULL;
    DELETE FROM budgets;
    DELETE FROM plan_life_events;
    DELETE FROM stores;
    DELETE FROM category_breakdowns;
    DELETE FROM categories;
    DELETE FROM sqlite_sequence
    WHERE name IN ('budgets', 'plan_life_events', 'stores', 'category_breakdowns', 'categories');
  `);

  ensureDefaultCategories();
}

function resolveTransactionSnapshot(
  categoryId: number,
  breakdownId?: number | null,
): { categoryName: string; categoryColor: string; breakdownName: string } {
  const category = getCategoryById(categoryId);
  const breakdown =
    breakdownId != null
      ? db.getFirstSync<{ name: string }>(
          "SELECT name FROM category_breakdowns WHERE id = ? LIMIT 1",
          [breakdownId],
        )
      : null;

  return {
    categoryName: category?.name ?? "未分類",
    categoryColor: category?.color ?? "#666666",
    breakdownName: breakdown?.name ?? "",
  };
}

// Categories
export function getCategories(type?: TransactionType): Category[] {
  const rows = type
    ? db.getAllSync<any>(
        "SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, name ASC",
        [type],
      )
    : db.getAllSync<any>(
        "SELECT * FROM categories ORDER BY type, is_default DESC, name ASC",
      );
  return rows.map(mapCategory);
}

export function addCategory(
  name: string,
  type: TransactionType,
  color: string,
): number {
  const result = db.runSync(
    "INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 0)",
    [name, type, color],
  );
  return result.lastInsertRowId;
}

export function deleteCategory(id: number) {
  db.runSync(
    "UPDATE transactions SET category_id = NULL, breakdown_id = NULL WHERE category_id = ?",
    [id],
  );
  db.runSync("DELETE FROM budgets WHERE category_id = ?", [id]);
  db.runSync("DELETE FROM category_breakdowns WHERE category_id = ?", [id]);
  db.runSync("DELETE FROM categories WHERE id = ?", [id]);
}

export function updateCategory(id: number, name: string, color: string) {
  db.runSync("UPDATE categories SET name = ?, color = ? WHERE id = ?", [
    name,
    color,
    id,
  ]);
}

export function getCategoryById(id: number): Category | null {
  const row = db.getFirstSync<any>(
    "SELECT * FROM categories WHERE id = ? LIMIT 1",
    [id],
  );
  return row ? mapCategory(row) : null;
}

export function getBreakdownsByCategory(categoryId: number): Breakdown[] {
  const rows = db.getAllSync<any>(
    "SELECT * FROM category_breakdowns WHERE category_id = ? ORDER BY is_default DESC, name ASC",
    [categoryId],
  );
  return rows.map(mapBreakdown);
}

export function addBreakdown(categoryId: number, name: string): number {
  const result = db.runSync(
    "INSERT INTO category_breakdowns (category_id, name, is_default) VALUES (?, ?, 0)",
    [categoryId, name],
  );
  return result.lastInsertRowId;
}

export function updateBreakdown(id: number, name: string) {
  db.runSync("UPDATE category_breakdowns SET name = ? WHERE id = ?", [
    name,
    id,
  ]);
}

export function deleteBreakdown(id: number) {
  db.runSync(
    "UPDATE transactions SET breakdown_id = NULL WHERE breakdown_id = ?",
    [id],
  );
  db.runSync("DELETE FROM category_breakdowns WHERE id = ?", [id]);
}

// Transactions
export function addTransaction(
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: number,
  memo: string,
  breakdownId?: number | null,
  storeId?: number | null,
): number {
  const snapshot = resolveTransactionSnapshot(categoryId, breakdownId);
  const storeNameSnapshot = storeId
    ? db.getFirstSync<{ name: string }>(
        "SELECT name FROM stores WHERE id = ? LIMIT 1",
        [storeId],
      )?.name ?? ""
    : "";
  if (storeId) {
    db.runSync(
      "UPDATE stores SET last_used_at = datetime('now', 'localtime') WHERE id = ?",
      [storeId],
    );
  }
  const result = db.runSync(
    "INSERT INTO transactions (date, amount, type, category_id, breakdown_id, category_name_snapshot, category_color_snapshot, breakdown_name_snapshot, memo, store_id, store_name_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      date,
      amount,
      type,
      categoryId,
      breakdownId ?? null,
      snapshot.categoryName,
      snapshot.categoryColor,
      snapshot.breakdownName,
      memo,
      storeId ?? null,
      storeNameSnapshot,
    ],
  );
  return result.lastInsertRowId;
}

export function updateTransaction(
  id: number,
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: number,
  memo: string,
  breakdownId?: number | null,
  storeId?: number | null,
) {
  const snapshot = resolveTransactionSnapshot(categoryId, breakdownId);
  const storeNameSnapshot = storeId
    ? db.getFirstSync<{ name: string }>(
        "SELECT name FROM stores WHERE id = ? LIMIT 1",
        [storeId],
      )?.name ?? ""
    : "";
  if (storeId) {
    db.runSync(
      "UPDATE stores SET last_used_at = datetime('now', 'localtime') WHERE id = ?",
      [storeId],
    );
  }
  db.runSync(
    "UPDATE transactions SET date=?, amount=?, type=?, category_id=?, breakdown_id=?, category_name_snapshot=?, category_color_snapshot=?, breakdown_name_snapshot=?, memo=?, store_id=?, store_name_snapshot=? WHERE id=?",
    [
      date,
      amount,
      type,
      categoryId,
      breakdownId ?? null,
      snapshot.categoryName,
      snapshot.categoryColor,
      snapshot.breakdownName,
      memo,
      storeId ?? null,
      storeNameSnapshot,
      id,
    ],
  );
}

export function deleteTransaction(id: number) {
  db.runSync("DELETE FROM transactions WHERE id = ?", [id]);
}

// Stores
export function getStoresByCategory(categoryId: number): Store[] {
  const rows = db.getAllSync<any>(
    "SELECT * FROM stores WHERE category_id = ? ORDER BY last_used_at DESC, name ASC",
    [categoryId],
  );
  return rows.map(mapStore);
}

export function upsertStore(name: string, categoryId: number): number {
  db.runSync(
    "INSERT OR IGNORE INTO stores (name, category_id) VALUES (?, ?)",
    [name, categoryId],
  );
  const row = db.getFirstSync<{ id: number }>(
    "SELECT id FROM stores WHERE name = ? AND category_id = ? LIMIT 1",
    [name, categoryId],
  );
  return row!.id;
}

export function addLifeEvent(eventType: string, paramsJson: string): number {
  const result = db.runSync(
    `INSERT INTO plan_life_events (event_type, params_json, updated_at)
     VALUES (?, ?, datetime('now', 'localtime'))`,
    [eventType, paramsJson],
  );
  return result.lastInsertRowId;
}

export function updateLifeEvent(id: number, paramsJson: string) {
  db.runSync(
    `UPDATE plan_life_events
     SET params_json = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [paramsJson, id],
  );
}

export function deleteLifeEvent(id: number) {
  db.runSync("DELETE FROM plan_life_events WHERE id = ?", [id]);
}

export function getLifeEvents(): PlanLifeEvent[] {
  const rows = db.getAllSync<any>(
    `SELECT * FROM plan_life_events
     ORDER BY created_at ASC, id ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    paramsJson: r.params_json,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getTransactionsByMonth(
  year: number,
  month: number,
): Transaction[] {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color, b.name as breakdown_name
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN category_breakdowns b ON t.breakdown_id = b.id
       WHERE t.date >= ? AND t.date <= ?
       ORDER BY t.date DESC, t.created_at DESC`,
      [from, to],
    )
    .map(mapTransaction);
}

export function getTransactionsByDate(date: string): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color, b.name as breakdown_name
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN category_breakdowns b ON t.breakdown_id = b.id
       WHERE t.date = ?
       ORDER BY t.created_at DESC`,
      [date],
    )
    .map(mapTransaction);
}

export function getTransactionsByYear(year: number): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color, b.name as breakdown_name
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN category_breakdowns b ON t.breakdown_id = b.id
       WHERE t.date >= ? AND t.date <= ?
       ORDER BY t.date DESC`,
      [`${year}-01-01`, `${year}-12-31`],
    )
    .map(mapTransaction);
}

export function getAllTransactions(): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color, b.name as breakdown_name
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN category_breakdowns b ON t.breakdown_id = b.id
       ORDER BY t.date DESC, t.created_at DESC`,
    )
    .map(mapTransaction);
}

export interface MonthlyCategorySummary {
  type: TransactionType;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  total: number;
}

export function getMonthCategorySummary(
  year: number,
  month: number,
): MonthlyCategorySummary[] {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;
  return db
    .getAllSync<any>(
      `SELECT
       t.type,
       COALESCE(t.category_id, 0) as category_id,
       COALESCE(NULLIF(t.category_name_snapshot, ''), c.name, '未分類') as category_name,
       COALESCE(NULLIF(t.category_color_snapshot, ''), c.color, '#666666') as category_color,
       SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.date >= ? AND t.date <= ?
     GROUP BY
       t.type,
       COALESCE(t.category_id, 0),
       COALESCE(NULLIF(t.category_name_snapshot, ''), c.name, '未分類'),
       COALESCE(NULLIF(t.category_color_snapshot, ''), c.color, '#666666')
     ORDER BY t.type, total DESC`,
      [from, to],
    )
    .map((r) => ({
      type: r.type as TransactionType,
      categoryId: r.category_id,
      categoryName: r.category_name || "未分類",
      categoryColor: r.category_color || "#666666",
      total: r.total,
    }));
}

export interface MonthlyTotal {
  month: number;
  income: number;
  expense: number;
}

export function setMonthlyBudget(categoryId: number, amount: number) {
  db.runSync(
    `INSERT INTO budgets (year, month, category_id, amount, updated_at)
     VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(year, month, category_id)
     DO UPDATE SET amount = excluded.amount, updated_at = datetime('now', 'localtime')`,
    [0, 0, categoryId, amount],
  );
}

export function deleteMonthlyBudget(categoryId: number) {
  db.runSync(
    "DELETE FROM budgets WHERE year = 0 AND month = 0 AND category_id = ?",
    [categoryId],
  );
}

export function getMonthlyBudgets(
  type: TransactionType = "expense",
): MonthlyBudget[] {
  return db
    .getAllSync<any>(
      `SELECT
         c.id as category_id,
         c.name as category_name,
         c.color as category_color,
         COALESCE(b.amount, 0) as amount
       FROM categories c
       LEFT JOIN budgets b
         ON b.category_id = c.id AND b.year = 0 AND b.month = 0
       WHERE c.type = ?
       ORDER BY c.is_default DESC, c.name ASC`,
      [type],
    )
    .map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      categoryColor: r.category_color,
      amount: r.amount,
    }));
}

export function getMonthBudgetStatuses(
  year: number,
  month: number,
): BudgetStatus[] {
  const rows = db.getAllSync<any>(
    `SELECT
       c.id as category_id,
       c.name as category_name,
       c.color as category_color,
       b.amount as budget_amount,
       COALESCE((
         SELECT SUM(t.amount)
         FROM transactions t
         WHERE t.type = 'expense'
           AND t.date >= ?
           AND t.date <= ?
           AND (
             t.category_id = c.id
             OR (
               t.category_id IS NULL
               AND COALESCE(NULLIF(t.category_name_snapshot, ''), '未分類') = c.name
             )
           )
       ), 0) as spent_amount
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.year = ?
       AND b.month = ?
       AND c.type = 'expense'
       AND b.amount > 0
     ORDER BY c.name ASC`,
    [
      `${year}-${String(month).padStart(2, "0")}-01`,
      `${year}-${String(month).padStart(2, "0")}-31`,
      0,
      0,
    ],
  );

  return rows
    .map((row) => {
      const budgetAmount = row.budget_amount as number;
      const spentAmount = row.spent_amount as number;
      const usageRate = budgetAmount > 0 ? spentAmount / budgetAmount : 0;
      const level: BudgetAlertLevel =
        usageRate >= 1 ? "exceeded" : usageRate >= 0.8 ? "warning" : "none";

      return {
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryColor: row.category_color,
        budgetAmount,
        spentAmount,
        usageRate,
        level,
      };
    })
    .sort((a, b) => b.usageRate - a.usageRate);
}

export function getBudgetStatusForDate(
  date: string,
  categoryId: number,
): BudgetStatus | null {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    return null;
  }

  const category = getCategoryById(categoryId);
  if (!category || category.type !== "expense") {
    return null;
  }

  const budget = db.getFirstSync<{ amount: number }>(
    "SELECT amount FROM budgets WHERE year = ? AND month = ? AND category_id = ? LIMIT 1",
    [0, 0, categoryId],
  );
  if (!budget || budget.amount <= 0) {
    return null;
  }

  const spent = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE type = 'expense'
       AND (
         category_id = ?
         OR (
           category_id IS NULL
           AND COALESCE(NULLIF(category_name_snapshot, ''), '未分類') = ?
         )
       )
       AND date >= ?
       AND date <= ?`,
    [
      categoryId,
      category.name,
      `${year}-${String(month).padStart(2, "0")}-01`,
      `${year}-${String(month).padStart(2, "0")}-31`,
    ],
  );

  const spentAmount = spent?.total ?? 0;
  const usageRate = spentAmount / budget.amount;
  const level: BudgetAlertLevel =
    usageRate >= 1 ? "exceeded" : usageRate >= 0.8 ? "warning" : "none";

  return {
    categoryId,
    categoryName: category.name,
    categoryColor: category.color,
    budgetAmount: budget.amount,
    spentAmount,
    usageRate,
    level,
  };
}

export function getYearMonthlyTotals(year: number): MonthlyTotal[] {
  const rows = db.getAllSync<any>(
    `SELECT CAST(strftime('%m', date) AS INTEGER) as month, type, SUM(amount) as total
     FROM transactions
     WHERE date >= ? AND date <= ?
     GROUP BY month, type
     ORDER BY month`,
    [`${year}-01-01`, `${year}-12-31`],
  );

  const map: Record<number, MonthlyTotal> = {};
  for (let m = 1; m <= 12; m++) {
    map[m] = { month: m, income: 0, expense: 0 };
  }
  for (const r of rows) {
    if (r.type === "income") map[r.month].income = r.total;
    else map[r.month].expense = r.total;
  }
  return Object.values(map);
}

export function getDatesWithTransactions(
  year: number,
  month: number,
): string[] {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;
  const rows = db.getAllSync<{ date: string }>(
    "SELECT DISTINCT date FROM transactions WHERE date >= ? AND date <= ?",
    [from, to],
  );
  return rows.map((r) => r.date);
}

function mapCategory(r: any): Category {
  return {
    id: r.id,
    name: r.name,
    type: r.type as TransactionType,
    color: r.color,
    isDefault: r.is_default === 1,
  };
}

function mapBreakdown(r: any): Breakdown {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    isDefault: r.is_default === 1,
  };
}

function mapTransaction(r: any): Transaction {
  return {
    id: r.id,
    date: r.date,
    amount: r.amount,
    type: r.type as TransactionType,
    categoryId: r.category_id ?? null,
    categoryName: r.category_name_snapshot || r.category_name || "未分類",
    categoryColor: r.category_color_snapshot || r.category_color || "#666666",
    breakdownId: r.breakdown_id ?? null,
    breakdownName: r.breakdown_name_snapshot || r.breakdown_name || "",
    storeId: r.store_id ?? null,
    storeName: r.store_name_snapshot || "",
    memo: r.memo || "",
    createdAt: r.created_at,
  };
}

function mapStore(r: any): Store {
  return {
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    lastUsedAt: r.last_used_at,
  };
}

// モジュールロード時に即時初期化（useEffectより先に実行されるため競合を防ぐ）
initDatabase();
