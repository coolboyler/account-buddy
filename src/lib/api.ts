import { createClient, type Session } from '@supabase/supabase-js';
import type { AppBootstrap, Expense, ExpenseDraft, User } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
const LOGIN_DOMAIN = import.meta.env.VITE_SUPABASE_LOGIN_DOMAIN ?? 'account-buddy.local';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  date: string;
  category: Expense['category'];
  settled_at: string | null;
}

interface UserRow {
  id: string;
  name: string;
}

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new ApiError('Supabase 环境变量未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY');
  }
}

function assertNoError(error: { message: string; status?: number } | null, fallback: string) {
  if (error) {
    throw new ApiError(error.message || fallback, error.status ?? 500);
  }
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    date: row.date,
    category: row.category,
    settledAt: row.settled_at,
  };
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
  };
}

function toLoginEmail(username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  return normalizedUsername.includes('@')
    ? normalizedUsername
    : `${normalizedUsername}@${LOGIN_DOMAIN}`;
}

export async function getCurrentSession() {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.getSession();
  assertNoError(error, '读取登录状态失败');
  return data.session;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  assertNoError(error, '退出登录失败');
}

export function setApiAuthToken(_token: string | null) {
  // Kept for older tests/imports; Supabase persists and refreshes its own session.
}

export async function getBootstrap(): Promise<AppBootstrap> {
  requireSupabaseConfig();
  const [usersResult, expensesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, name')
      .order('id', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, description, amount, paid_by, date, category, settled_at')
      .order('date', { ascending: false })
      .order('settled_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ]);

  assertNoError(usersResult.error, '加载用户失败');
  assertNoError(expensesResult.error, '加载账单失败');

  return {
    users: (usersResult.data ?? []).map((row) => mapUser(row as UserRow)),
    expenses: (expensesResult.data ?? []).map((row) => mapExpense(row as ExpenseRow)),
  };
}

export async function createExpense(expense: ExpenseDraft) {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      id: crypto.randomUUID(),
      description: expense.description,
      amount: expense.amount,
      paid_by: expense.paidBy,
      date: expense.date,
      category: expense.category,
      settled_at: null,
    })
    .select('id, description, amount, paid_by, date, category, settled_at')
    .single();

  assertNoError(error, '创建支出失败');
  return mapExpense(data as ExpenseRow);
}

export async function updateExpense(expense: Expense) {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from('expenses')
    .update({
      description: expense.description,
      amount: expense.amount,
      paid_by: expense.paidBy,
      date: expense.date,
      category: expense.category,
    })
    .eq('id', expense.id)
    .select('id, description, amount, paid_by, date, category, settled_at')
    .single();

  assertNoError(error, '更新支出失败');
  return mapExpense(data as ExpenseRow);
}

export async function deleteExpense(id: string) {
  requireSupabaseConfig();
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  assertNoError(error, '删除支出失败');
}

export async function updateUser(id: string, name: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', id)
    .select('id, name')
    .single();

  assertNoError(error, '保存用户失败');
  return mapUser(data as UserRow);
}

export async function settleUp(ids?: string[]) {
  requireSupabaseConfig();
  const settledAt = new Date().toISOString();
  let query = supabase
    .from('expenses')
    .update({ settled_at: settledAt })
    .is('settled_at', null);

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  }

  const { data, error } = await query.select('id');
  assertNoError(error, '结算失败');
  const clearedCount = (data ?? []).length;

  return {
    clearedCount,
    settledAt: clearedCount > 0 ? settledAt : null,
  };
}

export async function login(username: string, password: string) {
  requireSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toLoginEmail(username),
    password,
  });

  if (error) {
    throw new ApiError('用户名或密码错误', error.status ?? 401);
  }

  return {
    token: data.session?.access_token ?? '',
    session: data.session as Session | null,
    user: {
      id: data.user?.id ?? '',
      username,
    },
  };
}
