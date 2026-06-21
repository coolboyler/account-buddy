import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Expense, User } from './types';

const apiMocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getBootstrap: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  updateUser: vi.fn(),
  settleUp: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
  ...apiMocks,
}));

describe('App', () => {
  let users: User[];
  let expenses: Expense[];
  let currentDate: string;

  beforeEach(() => {
    currentDate = new Date().toISOString().slice(0, 10);
    users = [
      { id: '1', name: '室友 A' },
      { id: '2', name: '室友 B' },
    ];
    expenses = [
      {
        id: 'expense-1',
        description: '买菜',
        amount: 45,
        paidBy: '1',
        date: currentDate,
        category: '餐饮',
        settledAt: null,
      },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    apiMocks.getCurrentSession.mockResolvedValue(null);
    apiMocks.login.mockResolvedValue({ token: 'test-token', user: { id: 'admin', username: 'house' } });
    apiMocks.logout.mockResolvedValue(undefined);
    apiMocks.getBootstrap.mockImplementation(async () => ({ users, expenses }));
    apiMocks.createExpense.mockImplementation(async (draft: Omit<Expense, 'id' | 'settledAt'>) => {
      const createdExpense: Expense = {
        ...draft,
        id: `expense-${expenses.length + 1}`,
        settledAt: null,
      };
      expenses = [createdExpense, ...expenses];
      return createdExpense;
    });
    apiMocks.updateExpense.mockImplementation(async (expense: Expense) => {
      const currentExpense = expenses.find((item) => item.id === expense.id);
      const nextExpense = {
        ...expense,
        settledAt: currentExpense?.settledAt ?? null,
      };
      expenses = expenses.map((item) => (item.id === expense.id ? nextExpense : item));
      return nextExpense;
    });
    apiMocks.deleteExpense.mockImplementation(async (id: string) => {
      expenses = expenses.filter((expense) => expense.id !== id);
    });
    apiMocks.updateUser.mockImplementation(async (id: string, name: string) => {
      const nextUser = { id, name };
      users = users.map((user) => (user.id === id ? nextUser : user));
      return nextUser;
    });
    apiMocks.settleUp.mockImplementation(async (ids?: string[]) => {
      const settledAt = '2026-03-31T10:00:00.000Z';
      const targetIds = ids && ids.length > 0
        ? ids
        : expenses.filter((expense) => !expense.settledAt).map((expense) => expense.id);
      const clearedCount = expenses.filter((expense) => !expense.settledAt && targetIds.includes(expense.id)).length;
      expenses = expenses.map((expense) => (
        expense.settledAt || !targetIds.includes(expense.id) ? expense : { ...expense, settledAt }
      ));
      return { clearedCount, settledAt };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    for (const mock of Object.values(apiMocks)) {
      mock.mockReset();
    }
  });

  async function login(user: ReturnType<typeof userEvent.setup>) {
    render(<App />);
    await user.type(screen.getByLabelText('用户名'), 'house');
    await user.type(screen.getByLabelText('密码'), '260321');
    await user.click(screen.getByRole('button', { name: '登录' }));
  }

  it('loads data and completes the main ledger workflow', async () => {
    const user = userEvent.setup();
    await login(user);

    await screen.findByText('买菜');
    expect(apiMocks.login).toHaveBeenCalledWith('house', '260321');
    expect(apiMocks.getBootstrap).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('导出账单')).toBeNull();
    expect(screen.getByText(/当前默认按两人 50\/50 平摊/)).not.toBeNull();
    expect(screen.getAllByText('人均 ¥22.50').length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('添加支出'));
    await user.type(screen.getByLabelText('支出描述'), '电费');
    await user.type(screen.getByLabelText('金额 (¥)'), '88');
    await user.selectOptions(screen.getByLabelText('分类'), '居住');
    await screen.findByText(/平摊后每人/);
    await user.click(screen.getByRole('button', { name: '添加' }));
    await screen.findByText('电费');

    await user.click(screen.getByLabelText('编辑 电费'));
    expect(screen.getByText('编辑支出')).not.toBeNull();
    const descriptionInput = screen.getByLabelText('支出描述');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, '电费已修改');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(apiMocks.updateExpense).toHaveBeenCalledWith({
        id: 'expense-2',
        description: '电费已修改',
        amount: 88,
        paidBy: '1',
        date: currentDate,
        category: '居住',
      });
    });

    await user.click(screen.getByLabelText('打开室友设置'));
    await user.clear(screen.getByLabelText('室友 A 姓名'));
    await user.type(screen.getByLabelText('室友 A 姓名'), '阿明');
    await user.clear(screen.getByLabelText('室友 B 姓名'));
    await user.type(screen.getByLabelText('室友 B 姓名'), '小雨');
    await user.click(screen.getByRole('button', { name: '保存更改' }));
    await screen.findByText('室友名称已更新');

    await user.click(screen.getByLabelText('删除 买菜'));
    await waitFor(() => {
      expect(screen.queryByText('买菜')).toBeNull();
    });

    await user.click(screen.getByLabelText('选择支出 电费已修改'));
    await user.click(screen.getByRole('button', { name: '结算(1)' }));
    await user.click(screen.getByRole('button', { name: '确认' }));
    await screen.findByText('已结算');
    await screen.findByText('账单历史');
    expect(screen.getAllByText('电费已修改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('人均 ¥44.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未结算笔数').length).toBeGreaterThan(0);

    expect(apiMocks.settleUp).toHaveBeenCalledWith(['expense-2']);
  });

  it('prevents accidental duplicate additions unless explicitly confirmed', async () => {
    const user = userEvent.setup();
    await login(user);

    await screen.findByText('买菜');

    await user.click(screen.getByLabelText('添加支出'));
    await user.clear(screen.getByLabelText('支出描述'));
    await user.type(screen.getByLabelText('支出描述'), '买菜');
    await user.clear(screen.getByLabelText('金额 (¥)'));
    await user.type(screen.getByLabelText('金额 (¥)'), '45');
    await user.selectOptions(screen.getByLabelText('付款人'), '1');
    await user.selectOptions(screen.getByLabelText('分类'), '餐饮');

    expect(screen.getByText('疑似重复账单')).not.toBeNull();
    const submitButton = screen.getByRole('button', { name: '添加' });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByLabelText(/确认不是误添加/));
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiMocks.createExpense).toHaveBeenCalledOnce();
    });
  });
});
