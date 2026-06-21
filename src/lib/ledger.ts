import type { Category, Expense, User } from '../types';

export interface LedgerSummary {
  totalExpenses: number;
  categoryTotals: Record<Category, number>;
  userPaidTotals: Record<string, number>;
  userNetBalances: Record<string, number>;
  splitPerUser: number;
  amountOwed: number;
  debtorId: string | null;
  creditorId: string | null;
}

export function calculateLedgerSummary(users: User[], expenses: Expense[]): LedgerSummary {
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const splitPerUser = users.length > 0 ? totalExpenses / users.length : 0;
  const categoryTotals: Record<Category, number> = {
    餐饮: 0,
    购物: 0,
    居住: 0,
    交通: 0,
    娱乐: 0,
    其他: 0,
  };
  const userPaidTotals = Object.fromEntries(users.map((user) => [user.id, 0])) as Record<string, number>;

  for (const expense of expenses) {
    categoryTotals[expense.category] += expense.amount;
    userPaidTotals[expense.paidBy] = (userPaidTotals[expense.paidBy] ?? 0) + expense.amount;
  }

  const userNetBalances = Object.fromEntries(
    users.map((user) => [user.id, (userPaidTotals[user.id] ?? 0) - splitPerUser]),
  ) as Record<string, number>;

  if (users.length !== 2) {
    return {
      totalExpenses,
      categoryTotals,
      userPaidTotals,
      userNetBalances,
      splitPerUser,
      amountOwed: 0,
      debtorId: null,
      creditorId: null,
    };
  }

  const [user1, user2] = users;
  const user1Balance = (userPaidTotals[user1.id] ?? 0) - splitPerUser;
  const user2Balance = (userPaidTotals[user2.id] ?? 0) - splitPerUser;

  if (user1Balance > 0.01) {
    return {
      totalExpenses,
      categoryTotals,
      userPaidTotals,
      userNetBalances,
      splitPerUser,
      amountOwed: user1Balance,
      debtorId: user2.id,
      creditorId: user1.id,
    };
  }

  if (user2Balance > 0.01) {
    return {
      totalExpenses,
      categoryTotals,
      userPaidTotals,
      userNetBalances,
      splitPerUser,
      amountOwed: user2Balance,
      debtorId: user1.id,
      creditorId: user2.id,
    };
  }

  return {
    totalExpenses,
    categoryTotals,
    userPaidTotals,
    userNetBalances,
    splitPerUser,
    amountOwed: 0,
    debtorId: null,
    creditorId: null,
  };
}
