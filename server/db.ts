import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type { Expense, ExpenseDraft, User } from '../src/types.ts';
import { CATEGORIES, DEFAULT_USERS } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const defaultDatabasePath = process.env.DB_PATH ?? path.join(projectRoot, 'data', 'accountbuddy.sqlite');

function ensureDatabaseDirectory(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    description: String(row.description),
    amount: Number(row.amount),
    paidBy: String(row.paid_by),
    date: String(row.date),
    category: String(row.category) as Expense['category'],
    settledAt: row.settled_at ? String(row.settled_at) : null,
  };
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
  };
}

export interface AuthUser {
  id: string;
  username: string;
  passwordHash: string;
}

export interface LedgerStore {
  db: DatabaseSync;
  getUsers(): User[];
  getExpenses(): Expense[];
  createExpense(expense: Expense): Expense;
  updateExpense(id: string, expense: ExpenseDraft): Expense | null;
  deleteExpense(id: string): boolean;
  updateUser(id: string, name: string): User | null;
  settleUp(ids?: string[]): { clearedCount: number; settledAt: string | null };
  createUser(username: string, passwordHash: string): AuthUser | null;
  getUserByUsername(username: string): AuthUser | null;
  close(): void;
}

export function createLedgerStore(dbPath = defaultDatabasePath): LedgerStore {
  ensureDatabaseDirectory(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      paid_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      settled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const expenseColumns = db.prepare('PRAGMA table_info(expenses)').all() as Array<Record<string, unknown>>;
  const hasSettledAtColumn = expenseColumns.some((column) => column.name === 'settled_at');
  if (!hasSettledAtColumn) {
    db.exec('ALTER TABLE expenses ADD COLUMN settled_at TEXT');
  }

  const userCount = Number(db.prepare('SELECT COUNT(*) AS count FROM users').get().count ?? 0);
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (id, name) VALUES (?, ?)');
    for (const user of DEFAULT_USERS) {
      insertUser.run(user.id, user.name);
    }
  }

  // 创建默认管理员账户 (username: house, password: 260321)
  const authUserCount = Number(db.prepare('SELECT COUNT(*) AS count FROM auth_users').get().count ?? 0);
  if (authUserCount === 0) {
    const defaultPasswordHash = crypto.createHash('sha256').update('260321').digest('hex');
    const insertAuthUser = db.prepare('INSERT INTO auth_users (id, username, password_hash) VALUES (?, ?, ?)');
    insertAuthUser.run('admin', 'house', defaultPasswordHash);
  }

  const getUsersStatement = db.prepare('SELECT id, name FROM users ORDER BY id ASC');
  const getExpensesStatement = db.prepare(`
    SELECT id, description, amount, paid_by, date, category, settled_at
    FROM expenses
    ORDER BY date DESC, COALESCE(settled_at, '') DESC, rowid DESC
  `);
  const getExpenseByIdStatement = db.prepare(`
    SELECT id, description, amount, paid_by, date, category, settled_at
    FROM expenses
    WHERE id = ?
  `);
  const createExpenseStatement = db.prepare(`
    INSERT INTO expenses (id, description, amount, paid_by, date, category, settled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateExpenseStatement = db.prepare(`
    UPDATE expenses
    SET description = ?, amount = ?, paid_by = ?, date = ?, category = ?
    WHERE id = ?
  `);
  const deleteExpenseStatement = db.prepare('DELETE FROM expenses WHERE id = ?');
  const updateUserStatement = db.prepare('UPDATE users SET name = ? WHERE id = ?');
  const getUserByIdStatement = db.prepare('SELECT id, name FROM users WHERE id = ?');
  const userExistsStatement = db.prepare('SELECT id FROM users WHERE id = ?');
  const settleAllStatement = db.prepare(`
    UPDATE expenses
    SET settled_at = ?
    WHERE settled_at IS NULL
  `);
  const createUserStatement = db.prepare('INSERT INTO auth_users (id, username, password_hash) VALUES (?, ?, ?)');
  const getUserByUsernameStatement = db.prepare('SELECT id, username, password_hash FROM auth_users WHERE username = ?');

  return {
    db,
    getUsers() {
      return getUsersStatement.all().map((row) => mapUser(row as Record<string, unknown>));
    },
    getExpenses() {
      return getExpensesStatement.all().map((row) => mapExpense(row as Record<string, unknown>));
    },
    createExpense(expense) {
      if (!CATEGORIES.includes(expense.category)) {
        throw new Error('无效的支出分类');
      }

      if (!userExistsStatement.get(expense.paidBy)) {
        throw new Error('付款人不存在');
      }

      createExpenseStatement.run(
        expense.id,
        expense.description.trim(),
        expense.amount,
        expense.paidBy,
        expense.date,
        expense.category,
        expense.settledAt,
      );

      return mapExpense(getExpenseByIdStatement.get(expense.id) as Record<string, unknown>);
    },
    updateExpense(id, expense) {
      if (!CATEGORIES.includes(expense.category)) {
        throw new Error('无效的支出分类');
      }

      if (!userExistsStatement.get(expense.paidBy)) {
        throw new Error('付款人不存在');
      }

      const result = updateExpenseStatement.run(
        expense.description.trim(),
        expense.amount,
        expense.paidBy,
        expense.date,
        expense.category,
        id,
      );

      if (result.changes === 0) {
        return null;
      }

      return mapExpense(getExpenseByIdStatement.get(id) as Record<string, unknown>);
    },
    deleteExpense(id) {
      return deleteExpenseStatement.run(id).changes > 0;
    },
    updateUser(id, name) {
      const trimmedName = name.trim();
      const result = updateUserStatement.run(trimmedName, id);
      if (result.changes === 0) {
        return null;
      }

      return mapUser(getUserByIdStatement.get(id) as Record<string, unknown>);
    },
    settleUp(ids) {
      const normalizedIds = ids?.map((id) => id.trim()).filter(Boolean) ?? [];
      const settledAt = new Date().toISOString();

      // 安全修复：限制最大结算数量，防止 DoS
      const MAX_SETTLE_COUNT = 1000;
      if (normalizedIds.length > MAX_SETTLE_COUNT) {
        throw new Error(`一次最多只能结算 ${MAX_SETTLE_COUNT} 笔账单`);
      }

      // 安全修复：验证所有 ID 格式（UUID 格式）
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of normalizedIds) {
        if (!UUID_REGEX.test(id)) {
          throw new Error('无效的账单 ID 格式');
        }
      }

      let result;
      if (normalizedIds.length > 0) {
        // 使用参数化查询防止 SQL 注入
        const placeholders = normalizedIds.map(() => '?').join(', ');
        const settleSelectedStatement = db.prepare(`
          UPDATE expenses
          SET settled_at = ?
          WHERE settled_at IS NULL AND id IN (${placeholders})
        `);
        result = settleSelectedStatement.run(settledAt, ...normalizedIds);
      } else {
        result = settleAllStatement.run(settledAt);
      }

      const clearedCount = Number(result.changes ?? 0);

      return {
        clearedCount,
        settledAt: clearedCount > 0 ? settledAt : null,
      };
    },
    createUser(username: string, passwordHash: string): AuthUser | null {
      try {
        const id = crypto.randomUUID();
        createUserStatement.run(id, username, passwordHash);
        return { id, username, passwordHash };
      } catch {
        return null; // 用户名已存在
      }
    },
    getUserByUsername(username: string): AuthUser | null {
      const row = getUserByUsernameStatement.get(username) as Record<string, unknown> | undefined;
      if (!row) {
        return null;
      }
      return {
        id: String(row.id),
        username: String(row.username),
        passwordHash: String(row.password_hash),
      };
    },
    close() {
      db.close();
    },
  };
}
