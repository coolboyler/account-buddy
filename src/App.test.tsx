import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Expense, User } from './types';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('App', () => {
  let users: User[];
  let expenses: Expense[];
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
        date: '2026-03-21',
        category: '餐饮',
        settledAt: null,
      },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;

      if (url.endsWith('/api/bootstrap') && method === 'GET') {
        return jsonResponse({ users, expenses });
      }

      if (url.endsWith('/api/expenses') && method === 'POST' && body) {
        const createdExpense: Expense = {
          id: `expense-${expenses.length + 1}`,
          description: String(body.description),
          amount: Number(body.amount),
          paidBy: String(body.paidBy),
          date: String(body.date),
          category: body.category as Expense['category'],
          settledAt: null,
        };
        expenses = [createdExpense, ...expenses];
        return jsonResponse(createdExpense, 201);
      }

      if (url.includes('/api/expenses/') && method === 'PUT' && body) {
        const expenseId = url.split('/').pop() ?? '';
        const currentExpense = expenses.find((expense) => expense.id === expenseId);
        const nextExpense: Expense = {
          id: expenseId,
          description: String(body.description),
          amount: Number(body.amount),
          paidBy: String(body.paidBy),
          date: String(body.date),
          category: body.category as Expense['category'],
          settledAt: currentExpense?.settledAt ?? null,
        };
        expenses = expenses.map((expense) => (expense.id === expenseId ? nextExpense : expense));
        return jsonResponse(nextExpense);
      }

      if (url.includes('/api/expenses/') && method === 'DELETE') {
        const expenseId = url.split('/').pop() ?? '';
        expenses = expenses.filter((expense) => expense.id !== expenseId);
        return new Response(null, { status: 204 });
      }

      if (url.includes('/api/users/') && method === 'PUT' && body) {
        const userId = url.split('/').pop() ?? '';
        const nextUser = { id: userId, name: String(body.name) };
        users = users.map((user) => (user.id === userId ? nextUser : user));
        return jsonResponse(nextUser);
      }

      if (url.endsWith('/api/settlements') && method === 'POST') {
        const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
        const settledAt = '2026-03-31T10:00:00.000Z';
        const targetIds = ids.length > 0
          ? ids
          : expenses.filter((expense) => !expense.settledAt).map((expense) => expense.id);
        const clearedCount = expenses.filter((expense) => !expense.settledAt && targetIds.includes(expense.id)).length;
        expenses = expenses.map((expense) => (
          expense.settledAt || !targetIds.includes(expense.id) ? expense : { ...expense, settledAt }
        ));
        return jsonResponse({ clearedCount, settledAt });
      }

      return jsonResponse({ message: 'Unhandled request' }, 500);
    });

    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads data and completes the main ledger workflow', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('买菜');
    expect(fetchSpy).toHaveBeenCalledWith('/api/bootstrap', expect.any(Object));
    expect(screen.queryByLabelText('导出账单')).toBeNull();
    expect(screen.getByText(/当前默认按两人 50\/50 平摊/)).not.toBeNull();
    expect(screen.getAllByText('人均 ¥22.50').length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('添加支出'));
    await user.type(screen.getByLabelText('支出描述'), '电费');
    await user.type(screen.getByLabelText('金额 (¥)'), '88');
    await user.selectOptions(screen.getByLabelText('分类'), '居住');
    await screen.findByText('当前金额按两人平摊后，每人承担');
    await user.click(screen.getByRole('button', { name: '确认添加' }));
    await screen.findByText('电费');

    await user.click(screen.getByLabelText('编辑支出 电费'));
    expect(screen.getByText('编辑支出')).not.toBeNull();
    const descriptionInput = screen.getByLabelText('支出描述');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, '电费已修改');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => {
      const updateCall = fetchSpy.mock.calls.find(
        ([url, init]) => url === '/api/expenses/expense-2' && init?.method === 'PUT',
      );
      expect(updateCall).toBeTruthy();
      const requestInit = updateCall?.[1] as RequestInit;
      expect(JSON.parse(String(requestInit.body))).toEqual({
        id: 'expense-2',
        description: '电费已修改',
        amount: 88,
        paidBy: '1',
        date: '2026-03-21',
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

    await user.click(screen.getByLabelText('删除支出 买菜'));
    await waitFor(() => {
      expect(screen.queryByText('买菜')).toBeNull();
    });

    await user.click(screen.getByLabelText('选择支出 电费已修改'));
    await user.click(screen.getByRole('button', { name: '结算选中 (1)' }));
    await user.click(screen.getByRole('button', { name: '确认' }));
    await screen.findByText('已结算');
    await screen.findByText('账单历史');
    expect(screen.getAllByText('电费已修改').length).toBeGreaterThan(0);
    expect(screen.getAllByText('人均 ¥44.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未结算笔数').length).toBeGreaterThan(0);

    await waitFor(() => {
      const settlementCall = fetchSpy.mock.calls.find(
        ([url, init]) => url === '/api/settlements' && init?.method === 'POST',
      );
      expect(settlementCall).toBeTruthy();
      const requestInit = settlementCall?.[1] as RequestInit;
      expect(JSON.parse(String(requestInit.body))).toEqual({ ids: ['expense-2'] });
    });
  });

  it('prevents accidental duplicate additions unless explicitly confirmed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText('买菜');

    await user.click(screen.getByLabelText('添加支出'));
    await user.clear(screen.getByLabelText('支出描述'));
    await user.type(screen.getByLabelText('支出描述'), '买菜');
    await user.clear(screen.getByLabelText('金额 (¥)'));
    await user.type(screen.getByLabelText('金额 (¥)'), '45');
    await user.selectOptions(screen.getByLabelText('付款人'), '室友 A');
    await user.selectOptions(screen.getByLabelText('分类'), '餐饮');

    expect(screen.getByText('检测到疑似重复账单')).not.toBeNull();
    const submitButton = screen.getByRole('button', { name: '确认添加' });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByLabelText(/我已确认，这不是误添加/));
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(submitButton);

    await waitFor(() => {
      const createCalls = fetchSpy.mock.calls.filter(
        ([url, init]) => url === '/api/expenses' && init?.method === 'POST',
      );
      expect(createCalls).toHaveLength(1);
    });
  });
});
