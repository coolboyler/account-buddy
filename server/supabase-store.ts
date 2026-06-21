import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Expense, ExpenseDraft, User } from '../src/types.ts';
import { CATEGORIES, DEFAULT_USERS } from '../src/types.ts';
import type { AuthUser, LedgerStore } from './db.ts';

interface SupabaseConfig {
  url: string;
  key: string;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  date: string;
  category: string;
  settled_at: string | null;
}

interface UserRow {
  id: string;
  name: string;
}

interface AuthUserRow {
  id: string;
  username: string;
  password_hash: string;
}

function mapExpense(row: ExpenseRow): Expense {
  const category = CATEGORIES.includes(row.category as Expense['category'])
    ? row.category as Expense['category']
    : row.category === '日用品'
      ? '购物'
      : row.category === '房租'
        ? '居住'
        : '其他';

  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    date: row.date,
    category,
    settledAt: row.settled_at,
  };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
  };
}

function mapAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
  };
}

function assertNoError(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

function requireCategory(category: ExpenseDraft['category']) {
  if (!CATEGORIES.includes(category)) {
    throw new Error('无效的支出分类');
  }
}

export function getSupabaseConfigFromEnv(): SupabaseConfig | null {
  const projectId = process.env.SUPABASE_PROJECT_ID?.trim();
  const url = process.env.SUPABASE_URL?.trim() || (projectId ? `https://${projectId}.supabase.co` : '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();

  if (!url && !key) {
    return null;
  }

  if (!url || !key) {
    throw new Error('Supabase 配置不完整，请同时设置 SUPABASE_URL 或 SUPABASE_PROJECT_ID，以及 SUPABASE_PUBLISHABLE_KEY/ANON_KEY/SERVICE_ROLE_KEY');
  }

  return { url, key };
}

export function createSupabaseLedgerStore(config: SupabaseConfig): LedgerStore {
  const supabase = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  async function ensureSeeded() {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    assertNoError(usersError, '读取 Supabase users 表失败，请先执行 supabase/schema.sql 建表');

    if ((users ?? []).length === 0) {
      const { error } = await supabase.from('users').insert(DEFAULT_USERS);
      assertNoError(error, '初始化默认室友失败');
    }

    const { data: authUsers, error: authUsersError } = await supabase
      .from('auth_users')
      .select('id')
      .limit(1);
    assertNoError(authUsersError, '读取 Supabase auth_users 表失败，请先执行 supabase/schema.sql 建表');

    if ((authUsers ?? []).length === 0) {
      const passwordHash = crypto.createHash('sha256').update('260321').digest('hex');
      const { error } = await supabase.from('auth_users').insert({
        id: 'admin',
        username: 'house',
        password_hash: passwordHash,
      });
      assertNoError(error, '初始化默认登录账户失败');
    }
  }

  const ready = ensureSeeded();

  async function userExists(id: string) {
    await ready;
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, '验证付款人失败');
    return Boolean(data);
  }

  return {
    description: config.url,
    async getUsers() {
      await ready;
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('id', { ascending: true });
      assertNoError(error, '读取室友失败');
      return (data ?? []).map(mapUser);
    },
    async getExpenses() {
      await ready;
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, paid_by, date, category, settled_at')
        .order('date', { ascending: false })
        .order('settled_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      assertNoError(error, '读取账单失败');
      return (data ?? []).map(mapExpense);
    },
    async createExpense(expense) {
      await ready;
      requireCategory(expense.category);
      if (!(await userExists(expense.paidBy))) {
        throw new Error('付款人不存在');
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          id: expense.id,
          description: expense.description.trim(),
          amount: expense.amount,
          paid_by: expense.paidBy,
          date: expense.date,
          category: expense.category,
          settled_at: expense.settledAt,
        })
        .select('id, description, amount, paid_by, date, category, settled_at')
        .single();
      assertNoError(error, '创建支出失败');
      return mapExpense(data);
    },
    async updateExpense(id, expense) {
      await ready;
      requireCategory(expense.category);
      if (!(await userExists(expense.paidBy))) {
        throw new Error('付款人不存在');
      }

      const { data, error } = await supabase
        .from('expenses')
        .update({
          description: expense.description.trim(),
          amount: expense.amount,
          paid_by: expense.paidBy,
          date: expense.date,
          category: expense.category,
        })
        .eq('id', id)
        .select('id, description, amount, paid_by, date, category, settled_at')
        .maybeSingle();
      assertNoError(error, '更新支出失败');
      return data ? mapExpense(data) : null;
    },
    async deleteExpense(id) {
      await ready;
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .select('id');
      assertNoError(error, '删除支出失败');
      return (data ?? []).length > 0;
    },
    async updateUser(id, name) {
      await ready;
      const { data, error } = await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', id)
        .select('id, name')
        .maybeSingle();
      assertNoError(error, '更新用户失败');
      return data ? mapUser(data) : null;
    },
    async settleUp(ids) {
      await ready;
      const normalizedIds = ids?.map((id) => id.trim()).filter(Boolean) ?? [];
      const settledAt = new Date().toISOString();

      let query = supabase
        .from('expenses')
        .update({ settled_at: settledAt })
        .is('settled_at', null);

      if (normalizedIds.length > 0) {
        query = query.in('id', normalizedIds);
      }

      const { data, error } = await query.select('id');
      assertNoError(error, '结算失败');
      const clearedCount = (data ?? []).length;

      return {
        clearedCount,
        settledAt: clearedCount > 0 ? settledAt : null,
      };
    },
    async createUser(username, passwordHash) {
      await ready;
      const { data, error } = await supabase
        .from('auth_users')
        .insert({
          id: crypto.randomUUID(),
          username,
          password_hash: passwordHash,
        })
        .select('id, username, password_hash')
        .maybeSingle();

      if (error) {
        return null;
      }

      return data ? mapAuthUser(data) : null;
    },
    async getUserByUsername(username) {
      await ready;
      const { data, error } = await supabase
        .from('auth_users')
        .select('id, username, password_hash')
        .eq('username', username)
        .maybeSingle();
      assertNoError(error, '读取登录用户失败');
      return data ? mapAuthUser(data) : null;
    },
    close() {},
  };
}
