import React, { useState, useMemo } from 'react';
import { User, Expense, Category } from '../types';
import { Trash2, Edit2, Receipt, Utensils, ShoppingCart, Home, Car, Gamepad2, MoreHorizontal, Search, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Props {
  users: User[];
  expenses: Expense[];
  selectedExpenseIds: string[];
  onChangeSelectedExpenseIds: (ids: string[]) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  onEditExpense: (expense: Expense) => void;
  onSettleExpense: (expense: Expense) => void;
  onSettleSelectedExpenses: (ids: string[]) => void;
  deletingExpenseId: string | null;
  isSettling: boolean;
}

const CATEGORIES: Category[] = ['餐饮', '购物', '居住', '交通', '娱乐', '其他'];

const CategoryIcon = ({ category, className }: { category: Category, className?: string }) => {
  switch (category) {
    case '餐饮': return <Utensils className={className} />;
    case '购物': return <ShoppingCart className={className} />;
    case '居住': return <Home className={className} />;
    case '交通': return <Car className={className} />;
    case '娱乐': return <Gamepad2 className={className} />;
    default: return <MoreHorizontal className={className} />;
  }
};

export function ExpenseList({
  users,
  expenses,
  selectedExpenseIds,
  onChangeSelectedExpenseIds,
  onDeleteExpense,
  onEditExpense,
  onSettleExpense,
  onSettleSelectedExpenses,
  deletingExpenseId,
  isSettling,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | '全部'>('全部');
  const [statusFilter, setStatusFilter] = useState<'全部' | '未结算' | '已结算'>('全部');

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || '未知';

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === '全部' || exp.category === selectedCategory;
      const matchesStatus = statusFilter === '全部'
        || (statusFilter === '未结算' && !exp.settledAt)
        || (statusFilter === '已结算' && Boolean(exp.settledAt));
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [expenses, searchTerm, selectedCategory, statusFilter]);

  const visibleUnsettledIds = useMemo(
    () => filteredExpenses.filter((expense) => !expense.settledAt).map((expense) => expense.id),
    [filteredExpenses],
  );
  const selectedVisibleIds = selectedExpenseIds.filter((id) => visibleUnsettledIds.includes(id));
  const allVisibleSelected = visibleUnsettledIds.length > 0 && selectedVisibleIds.length === visibleUnsettledIds.length;

  const toggleExpenseSelection = (expenseId: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...selectedExpenseIds, expenseId]))
      : selectedExpenseIds.filter((id) => id !== expenseId);
    onChangeSelectedExpenseIds(nextIds);
  };

  const toggleAllVisibleSelection = () => {
    if (allVisibleSelected) {
      onChangeSelectedExpenseIds(selectedExpenseIds.filter((id) => !visibleUnsettledIds.includes(id)));
      return;
    }

    onChangeSelectedExpenseIds(Array.from(new Set([...selectedExpenseIds, ...visibleUnsettledIds])));
  };

  // Group expenses by date
  const groupedExpenses = filteredExpenses.reduce((acc, exp) => {
    const dateStr = exp.date.split('T')[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return '今天';
    if (isYesterday(date)) return '昨天';
    return format(date, 'M月d日 EEEE', { locale: zhCN });
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full max-h-[750px] sm:max-h-[850px]">
      <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3 sm:gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 tracking-wide">账单明细</h2>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">支持按状态筛选、逐笔结算和批量结算。</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
              共 {filteredExpenses.length} 笔
            </span>
            <span className="text-[11px] sm:text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
              未结算 {expenses.filter((expense) => !expense.settledAt).length} 笔
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {(['全部', '未结算', '已结算'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`whitespace-nowrap rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                statusFilter === status ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索账单..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
            />
          </div>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar -mx-1 px-1">
            <button
              onClick={() => setSelectedCategory('全部')}
              className={`whitespace-nowrap px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                selectedCategory === '全部' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                  selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {visibleUnsettledIds.length > 0 && (
          <div className="rounded-xl sm:rounded-2xl border border-emerald-100 bg-emerald-50 px-3 sm:px-4 py-3 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-800 min-w-0">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisibleSelection}
                  aria-label="选择当前可见的全部未结算账单"
                  className="w-4 h-4 shrink-0"
                />
                <span className="truncate whitespace-nowrap">{visibleUnsettledIds.length} 笔未结算</span>
              </div>
              <button
                type="button"
                onClick={() => onSettleSelectedExpenses(selectedVisibleIds)}
                disabled={selectedVisibleIds.length === 0 || isSettling}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 shrink-0 whitespace-nowrap"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                结算{selectedVisibleIds.length > 0 ? `(${selectedVisibleIds.length})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 sm:p-4 space-y-4 sm:space-y-6 bg-slate-50/30">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 h-full min-h-[250px] sm:min-h-[300px]">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-2">
              <Receipt className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h3 className="text-slate-700 font-medium text-base sm:text-lg">暂无匹配的支出</h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">尝试更改搜索词或分类筛选。</p>
            </div>
          </div>
        ) : (
          sortedDates.map((dateStr) => {
            const dayExpenses = groupedExpenses[dateStr];
            const dailyTotal = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

            return (
              <div key={dateStr} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-2 sm:mb-3 px-1 sm:px-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-700">
                    {formatDateLabel(dateStr)}
                  </h3>
                  <span className="text-xs sm:text-sm font-medium text-slate-500">
                    日支出: ¥{dailyTotal.toFixed(2)}
                  </span>
                </div>

                <ul className="bg-white border border-slate-100 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-50">
                  {dayExpenses.map((expense) => (
                    <li key={expense.id} className="p-3 sm:p-4 hover:bg-slate-50 transition-colors group flex items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        {!expense.settledAt && (
                          <input
                            type="checkbox"
                            checked={selectedExpenseIds.includes(expense.id)}
                            onChange={(event) => toggleExpenseSelection(expense.id, event.target.checked)}
                            aria-label={`选择支出 ${expense.description}`}
                            className="w-4 h-4 shrink-0"
                          />
                        )}
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <CategoryIcon category={expense.category || '其他'} className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 font-medium truncate text-sm leading-tight">{expense.description}</p>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] sm:text-xs text-slate-500 mt-0.5">
                            <span className="px-1 py-0.5 bg-slate-100 rounded text-slate-600 font-medium shrink-0">{expense.category || '其他'}</span>
                            <span className={`px-1 py-0.5 rounded font-medium shrink-0 ${
                              expense.settledAt ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {expense.settledAt ? '已结算' : '待结算'}
                            </span>
                            <span className="truncate max-w-[80px] sm:max-w-none">{getUserName(expense.paidBy)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="text-right min-w-[70px]">
                          <p className="text-slate-800 font-semibold text-sm">¥{expense.amount.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400">人均¥{(expense.amount / 2).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {!expense.settledAt && (
                            <button
                              onClick={() => onSettleExpense(expense)}
                              disabled={isSettling}
                              className="text-slate-400 hover:text-emerald-700 transition-colors p-1.5 rounded-lg hover:bg-emerald-50 touch-manipulation"
                              title="结算"
                              aria-label={`结算 ${expense.description}`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditExpense(expense)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors p-1.5 rounded-lg hover:bg-emerald-50 touch-manipulation"
                            title="编辑"
                            aria-label={`编辑 ${expense.description}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void onDeleteExpense(expense.id)}
                            disabled={deletingExpenseId === expense.id}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 touch-manipulation"
                            title="删除"
                            aria-label={`删除 ${expense.description}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
