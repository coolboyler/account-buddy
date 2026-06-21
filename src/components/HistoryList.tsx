import React, { useMemo, useState } from 'react';
import type { Expense, User } from '../types';
import { Archive, CalendarClock, Edit2, Search, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Props {
  expenses: Expense[];
  users: User[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  deletingExpenseId: string | null;
}

function formatSettlementLabel(settledAt: string) {
  return format(parseISO(settledAt), 'yyyy年M月d日 HH:mm', { locale: zhCN });
}

export function HistoryList({ expenses, users, onEditExpense, onDeleteExpense, deletingExpenseId }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const groupedHistory = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const settledExpenses = expenses.filter((expense) => {
      if (!expense.settledAt) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const paidByName = users.find((user) => user.id === expense.paidBy)?.name ?? '';
      return [expense.description, expense.category, expense.date, paidByName]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearchTerm);
    });
    const groups = settledExpenses.reduce((result, expense) => {
      const key = expense.settledAt as string;
      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(expense);
      return result;
    }, {} as Record<string, Expense[]>);

    return Object.entries(groups)
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([settledAt, items]) => ({
        settledAt,
        items: items.slice().sort((left, right) => right.date.localeCompare(left.date)),
        total: items.reduce((sum, item) => sum + item.amount, 0),
      }));
  }, [expenses, searchTerm, users]);

  const getUserName = (id: string) => users.find((user) => user.id === id)?.name || '未知';

  return (
    <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/70 px-4 sm:px-5 py-3 sm:py-4 gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-800">
            <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
            账单历史
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">已结算记录按批次保留，方便回看历史。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-slate-600 shrink-0">
          共 {groupedHistory.length} 次结算
        </span>
      </div>

      <div className="border-b border-slate-100 bg-white px-4 sm:px-5 py-3 sm:py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="搜索历史账单..."
            className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 py-2 sm:py-2.5 pl-8 sm:pl-9 pr-3 sm:pr-4 text-xs sm:text-sm text-slate-700 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="max-h-[480px] sm:max-h-[560px] space-y-4 sm:space-y-5 overflow-y-auto p-4 sm:p-5 bg-slate-50/30">
        {groupedHistory.length === 0 ? (
          <div className="rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-white px-4 sm:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-slate-500">
            暂无历史账单，结算后的记录会在这里显示。
          </div>
        ) : (
          groupedHistory.map((group) => (
            <div key={group.settledAt} className="rounded-xl sm:rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col gap-1.5 sm:gap-2 border-b border-slate-100 px-3 sm:px-4 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
                  <CalendarClock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">结算于 {formatSettlementLabel(group.settledAt)}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-500">
                  <span>{group.items.length} 笔</span>
                  <span>合计 ¥{group.total.toFixed(2)}</span>
                </div>
              </div>

              <ul className="divide-y divide-slate-100">
                {group.items.map((expense) => (
                  <li key={expense.id} className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-medium text-slate-800">{expense.description}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-slate-500">
                        <span>{expense.date}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{expense.category}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate max-w-[60px] sm:max-w-none">{getUserName(expense.paidBy)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="text-right min-w-[60px]">
                        <p className="shrink-0 text-xs sm:text-sm font-semibold text-slate-800">¥{expense.amount.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">人均¥{(expense.amount / 2).toFixed(2)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 touch-manipulation"
                        aria-label={`编辑 ${expense.description}`}
                        title="编辑"
                      >
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteExpense(expense.id)}
                        disabled={deletingExpenseId === expense.id}
                        className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:text-red-300 touch-manipulation"
                        aria-label={`删除 ${expense.description}`}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
