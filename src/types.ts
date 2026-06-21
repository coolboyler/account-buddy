export type Category = '餐饮' | '购物' | '居住' | '交通' | '娱乐' | '其他';

export const CATEGORIES: Category[] = ['餐饮', '购物', '居住', '交通', '娱乐', '其他'];

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // User ID
  date: string; // ISO date string (YYYY-MM-DD)
  category: Category;
  settledAt: string | null; // ISO datetime string
}

export type ExpenseDraft = Omit<Expense, 'id' | 'settledAt'>;

export interface User {
  id: string;
  name: string;
}

export interface AppBootstrap {
  users: User[];
  expenses: Expense[];
}

export const DEFAULT_USERS: User[] = [
  { id: '1', name: '室友 A' },
  { id: '2', name: '室友 B' },
];
