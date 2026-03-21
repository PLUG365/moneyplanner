import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('moneyplanner.db');

export type TransactionType = 'income' | 'expense';

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  color: string;
  isDefault: boolean;
}

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  type: TransactionType;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  memo: string;
  createdAt: string;
}

const DEFAULT_CATEGORIES = [
  { name: '給与', type: 'income', color: '#1565C0' },
  { name: '副業', type: 'income', color: '#1976D2' },
  { name: 'その他収入', type: 'income', color: '#42A5F5' },
  { name: '食費', type: 'expense', color: '#C62828' },
  { name: '住居費', type: 'expense', color: '#AD1457' },
  { name: '光熱費', type: 'expense', color: '#E65100' },
  { name: '通信費', type: 'expense', color: '#F57F17' },
  { name: '交通費', type: 'expense', color: '#2E7D32' },
  { name: '医療費', type: 'expense', color: '#00695C' },
  { name: '娯楽費', type: 'expense', color: '#4527A0' },
  { name: '衣服費', type: 'expense', color: '#6A1B9A' },
  { name: '教育費', type: 'expense', color: '#1B5E20' },
  { name: '保険料', type: 'expense', color: '#37474F' },
  { name: 'その他支出', type: 'expense', color: '#757575' },
];

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
      memo TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const count = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (count?.count === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      db.runSync(
        'INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 1)',
        [cat.name, cat.type, cat.color]
      );
    }
  }
}

// Categories
export function getCategories(type?: TransactionType): Category[] {
  const rows = type
    ? db.getAllSync<any>('SELECT * FROM categories WHERE type = ? ORDER BY is_default DESC, name ASC', [type])
    : db.getAllSync<any>('SELECT * FROM categories ORDER BY type, is_default DESC, name ASC');
  return rows.map(mapCategory);
}

export function addCategory(name: string, type: TransactionType, color: string): number {
  const result = db.runSync(
    'INSERT INTO categories (name, type, color, is_default) VALUES (?, ?, ?, 0)',
    [name, type, color]
  );
  return result.lastInsertRowId;
}

export function deleteCategory(id: number) {
  db.runSync('DELETE FROM categories WHERE id = ? AND is_default = 0', [id]);
}

export function updateCategory(id: number, name: string, color: string) {
  db.runSync('UPDATE categories SET name = ?, color = ? WHERE id = ?', [name, color, id]);
}

// Transactions
export function addTransaction(
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: number,
  memo: string
): number {
  const result = db.runSync(
    'INSERT INTO transactions (date, amount, type, category_id, memo) VALUES (?, ?, ?, ?, ?)',
    [date, amount, type, categoryId, memo]
  );
  return result.lastInsertRowId;
}

export function updateTransaction(
  id: number,
  date: string,
  amount: number,
  type: TransactionType,
  categoryId: number,
  memo: string
) {
  db.runSync(
    'UPDATE transactions SET date=?, amount=?, type=?, category_id=?, memo=? WHERE id=?',
    [date, amount, type, categoryId, memo, id]
  );
}

export function deleteTransaction(id: number) {
  db.runSync('DELETE FROM transactions WHERE id = ?', [id]);
}

export function getTransactionsByMonth(year: number, month: number): Transaction[] {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-31`;
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date <= ?
       ORDER BY t.date DESC, t.created_at DESC`,
      [from, to]
    )
    .map(mapTransaction);
}

export function getTransactionsByDate(date: string): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date = ?
       ORDER BY t.created_at DESC`,
      [date]
    )
    .map(mapTransaction);
}

export function getTransactionsByYear(year: number): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.date >= ? AND t.date <= ?
       ORDER BY t.date DESC`,
      [`${year}-01-01`, `${year}-12-31`]
    )
    .map(mapTransaction);
}

export function getAllTransactions(): Transaction[] {
  return db
    .getAllSync<any>(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
       ORDER BY t.date DESC, t.created_at DESC`
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

export function getMonthCategorySummary(year: number, month: number): MonthlyCategorySummary[] {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-31`;
  return db.getAllSync<any>(
    `SELECT t.type, t.category_id, c.name as category_name, c.color as category_color, SUM(t.amount) as total
     FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.date >= ? AND t.date <= ?
     GROUP BY t.type, t.category_id
     ORDER BY t.type, total DESC`,
    [from, to]
  ).map(r => ({
    type: r.type as TransactionType,
    categoryId: r.category_id,
    categoryName: r.category_name || '未分類',
    categoryColor: r.category_color || '#666666',
    total: r.total,
  }));
}

export interface MonthlyTotal {
  month: number;
  income: number;
  expense: number;
}

export function getYearMonthlyTotals(year: number): MonthlyTotal[] {
  const rows = db.getAllSync<any>(
    `SELECT CAST(strftime('%m', date) AS INTEGER) as month, type, SUM(amount) as total
     FROM transactions
     WHERE date >= ? AND date <= ?
     GROUP BY month, type
     ORDER BY month`,
    [`${year}-01-01`, `${year}-12-31`]
  );

  const map: Record<number, MonthlyTotal> = {};
  for (let m = 1; m <= 12; m++) {
    map[m] = { month: m, income: 0, expense: 0 };
  }
  for (const r of rows) {
    if (r.type === 'income') map[r.month].income = r.total;
    else map[r.month].expense = r.total;
  }
  return Object.values(map);
}

export function getDatesWithTransactions(year: number, month: number): string[] {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-31`;
  const rows = db.getAllSync<{ date: string }>(
    'SELECT DISTINCT date FROM transactions WHERE date >= ? AND date <= ?',
    [from, to]
  );
  return rows.map(r => r.date);
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

function mapTransaction(r: any): Transaction {
  return {
    id: r.id,
    date: r.date,
    amount: r.amount,
    type: r.type as TransactionType,
    categoryId: r.category_id,
    categoryName: r.category_name || '未分類',
    categoryColor: r.category_color || '#666666',
    memo: r.memo || '',
    createdAt: r.created_at,
  };
}

// モジュールロード時に即時初期化（useEffectより先に実行されるため競合を防ぐ）
initDatabase();
