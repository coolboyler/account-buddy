import React, { startTransition, useEffect, useMemo, useState } from 'react';
import type { Expense, ExpenseDraft, User } from './types';
import { format } from 'date-fns';
import { AlertCircle, LoaderCircle, Plus, RefreshCw, Wallet, LogOut } from 'lucide-react';
import { ExpenseList } from './components/ExpenseList';
import { BalanceCard } from './components/BalanceCard';
import { UserConfig } from './components/UserConfig';
import { SettleUpModal } from './components/SettleUpModal';
import { SummaryStats } from './components/SummaryStats';
import { MonthSelector } from './components/MonthSelector';
import { ExpenseModal } from './components/ExpenseModal';
import { HistoryList } from './components/HistoryList';
import { LoginPage } from './components/LoginPage';
import { ApiError, createExpense, deleteExpense, getBootstrap, setApiAuthToken, settleUp, updateExpense, updateUser } from './lib/api';
import { compareExpenseDates } from './lib/date';

const STORAGE_KEY = 'accountbuddy_token';

interface SettlementRequest {
  ids: string[];
  title: string;
  description: string;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlementRequest, setSettlementRequest] = useState<SettlementRequest | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isSavingUsers, setIsSavingUsers] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 检查本地存储的 token
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      setApiAuthToken(storedToken);
      setAuthToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // 登录成功后保存 token
  const handleLoginSuccess = (token: string) => {
    localStorage.setItem(STORAGE_KEY, token);
    setApiAuthToken(token);
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  // 登出
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiAuthToken(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    setExpenses([]);
    setUsers([]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStatusMessage(null);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  // 加载数据
  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      return;
    }

    let active = true;

    async function loadBootstrap() {
      try {
        setIsBootstrapping(true);
        const bootstrap = await getBootstrap();
        if (!active) {
          return;
        }

        startTransition(() => {
          setUsers(bootstrap.users);
          // 确保正确排序：已结算的按结算时间倒序，未结算的按日期倒序
          setExpenses(bootstrap.expenses.slice().sort(compareExpenseDates));
          setErrorMessage(null);
        });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          handleLogout();
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : '加载数据失败');
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    }

    void loadBootstrap();

    return () => {
      active = false;
    };
  }, [isAuthenticated, authToken]);

  const handleSaveExpense = async (expenseData: ExpenseDraft | Expense) => {
    // 防止重复提交
    if (isSavingExpense) {
      return false;
    }

    try {
      setIsSavingExpense(true);
      setErrorMessage(null);
      
      const savedExpense = 'id' in expenseData ? await updateExpense(expenseData) : await createExpense(expenseData);
      startTransition(() => {
        setExpenses((previousExpenses) => {
          const nextExpenses = 'id' in expenseData
            ? previousExpenses.map((expense) => (expense.id === savedExpense.id ? savedExpense : expense))
            : [savedExpense, ...previousExpenses];

          return nextExpenses.slice().sort(compareExpenseDates);
        });
      });
      setStatusMessage('id' in expenseData ? '账单已更新' : '账单已添加');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '保存账单失败';
      setErrorMessage(errorMsg);
      return false;
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    // 防止重复删除
    if (deletingExpenseId) {
      return;
    }

    if (!window.confirm('确认删除这笔支出吗？')) {
      return;
    }

    try {
      setDeletingExpenseId(id);
      setErrorMessage(null);
      await deleteExpense(id);
      startTransition(() => {
        setExpenses((previousExpenses) => previousExpenses.filter((expense) => expense.id !== id));
      });
      setStatusMessage('账单已删除');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除账单失败');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleUpdateUser = async (id: string, name: string) => {
    // 防止重复保存
    if (isSavingUsers) {
      return false;
    }

    try {
      setIsSavingUsers(true);
      setErrorMessage(null);
      const savedUser = await updateUser(id, name);
      startTransition(() => {
        setUsers((previousUsers) => previousUsers.map((user) => (user.id === id ? savedUser : user)));
      });
      setStatusMessage('室友名称已更新');
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存用户失败');
      return false;
    } finally {
      setIsSavingUsers(false);
    }
  };

  const openSettlementRequest = (ids: string[], title: string, description: string) => {
    const normalizedIds = Array.from(new Set(ids.filter(Boolean)));
    if (normalizedIds.length === 0) {
      setStatusMessage('当前没有可结算的账单');
      return;
    }

    setSettlementRequest({
      ids: normalizedIds,
      title,
      description,
    });
  };

  const handleSettleAll = () => {
    openSettlementRequest(
      openExpenses.map((expense) => expense.id),
      '确认结算全部未结算账单？',
      '这会把当前所有未结算账单标记为已结算，记录仍会保留在历史账单中。',
    );
  };

  const handleSettleSelectedExpenses = (ids: string[]) => {
    openSettlementRequest(
      ids,
      '确认结算选中账单？',
      '这会只结算你选中的账单，其余未结算账单会继续保留在当前账本中。',
    );
  };

  const handleSettleSingleExpense = (expense: Expense) => {
    openSettlementRequest(
      [expense.id],
      '确认结算这笔账单？',
      `这会把「${expense.description}」标记为已结算，但不会影响其他未结算账单。`,
    );
  };

  const confirmSettleUp = async () => {
    // 防止重复结算
    if (!settlementRequest || isSettling) {
      return;
    }

    try {
      setIsSettling(true);
      setErrorMessage(null);
      const { ids } = settlementRequest;
      const result = await settleUp(ids);
      startTransition(() => {
        setExpenses((previousExpenses) => previousExpenses.map((expense) => {
          // 修复：如果账单在 ids 中且未结算，更新 settledAt
          if (result.settledAt && ids.includes(expense.id) && !expense.settledAt) {
            return { ...expense, settledAt: result.settledAt };
          }
          return expense;
        }).sort(compareExpenseDates));
      });
      setSelectedExpenseIds((previousIds) => previousIds.filter((id) => !ids.includes(id)));
      setSettlementRequest(null);
      setStatusMessage(result.clearedCount > 0 ? `已结算 ${result.clearedCount} 笔账单，历史记录已保留` : '当前没有待结算账单');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '结算失败');
    } finally {
      setIsSettling(false);
    }
  };

  const currentMonthStr = format(currentMonth, 'yyyy-MM');
  const monthlyExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.startsWith(currentMonthStr)),
    [currentMonthStr, expenses],
  );
  const openExpenses = useMemo(
    () => expenses.filter((expense) => !expense.settledAt),
    [expenses],
  );
  const monthlyUnsettledExpenses = useMemo(
    () => monthlyExpenses.filter((expense) => !expense.settledAt),
    [monthlyExpenses],
  );
  const historyExpenses = useMemo(
    () => expenses.filter((expense) => expense.settledAt),
    [expenses],
  );

  useEffect(() => {
    const validIds = new Set(monthlyUnsettledExpenses.map((expense) => expense.id));
    setSelectedExpenseIds((previousIds) => previousIds.filter((id) => validIds.has(id)));
  }, [monthlyUnsettledExpenses]);

  const isBusy = isSavingExpense || isSettling || Boolean(deletingExpenseId) || isSavingUsers;

  // 未登录时显示登录页
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200 selection:text-emerald-900 pb-24">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm safe-area-top">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">室友记账本</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
            <UserConfig users={users} onUpdateUser={handleUpdateUser} isSaving={isSavingUsers} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {(errorMessage || statusMessage) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 flex items-center justify-between gap-4 ${
              errorMessage
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              {errorMessage ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Wallet className="w-4 h-4 shrink-0" />}
              <span>{errorMessage || statusMessage}</span>
            </div>
            {errorMessage && (
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
            )}
          </div>
        )}

        <MonthSelector currentMonth={currentMonth} onChangeMonth={setCurrentMonth} />

        {!isBootstrapping && (
          <div className="mb-4 sm:mb-6 rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
            当前默认按两人 50/50 平摊；当前结余只统计未结算账单，月度总结和账单明细会保留已结算记录，历史账单可在下方查看。
          </div>
        )}

        {isBootstrapping ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm flex min-h-[300px] sm:min-h-[360px] flex-col items-center justify-center gap-4 text-slate-500">
            <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600" />
            <div className="text-center">
              <p className="font-semibold text-slate-700">正在加载账本</p>
              <p className="mt-1 text-sm">正在从 SQLite 后端读取室友数据。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
              <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
                <BalanceCard users={users} expenses={openExpenses} onSettleUp={handleSettleAll} isSettling={isSettling} />
                <SummaryStats expenses={monthlyExpenses} unsettledExpenses={monthlyUnsettledExpenses} users={users} />
              </div>

              <div className="lg:col-span-7">
                <ExpenseList
                  users={users}
                  expenses={monthlyExpenses}
                  selectedExpenseIds={selectedExpenseIds}
                  onChangeSelectedExpenseIds={setSelectedExpenseIds}
                  onDeleteExpense={handleDeleteExpense}
                  onEditExpense={handleEditExpense}
                  onSettleExpense={handleSettleSingleExpense}
                  onSettleSelectedExpenses={handleSettleSelectedExpenses}
                  deletingExpenseId={deletingExpenseId}
                  isSettling={isSettling}
                />
              </div>
            </div>

            <HistoryList
              users={users}
              expenses={historyExpenses}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
              deletingExpenseId={deletingExpenseId}
            />
          </div>
        )}
      </main>

      <button
        onClick={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
        disabled={isBootstrapping || isBusy}
        className="fixed bottom-6 sm:bottom-8 right-4 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40 safe-area-bottom safe-area-right"
        title="添加支出"
        aria-label="添加支出"
      >
        <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <ExpenseModal 
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        users={users}
        initialData={editingExpense}
        existingExpenses={expenses}
        onSaveExpense={handleSaveExpense}
        isSaving={isSavingExpense}
      />

      <SettleUpModal 
        isOpen={Boolean(settlementRequest)} 
        onConfirm={confirmSettleUp} 
        onCancel={() => setSettlementRequest(null)} 
        isPending={isSettling}
        count={settlementRequest?.ids.length ?? 0}
        title={settlementRequest?.title ?? '确认结算？'}
        description={settlementRequest?.description ?? '这会把未结算账单标记为已结算。'}
      />
    </div>
  );
}
