import React, { useEffect, useMemo, useState } from 'react';
import type { User, Category, Expense, ExpenseDraft } from '../types';
import { CATEGORIES } from '../types';
import { AlertTriangle, LoaderCircle, PlusCircle, Save } from 'lucide-react';
import { getTodayDateString } from '../lib/date';

interface Props {
  users: User[];
  initialData?: Expense | null;
  existingExpenses: Expense[];
  onSave: (expenseData: ExpenseDraft | Expense) => Promise<boolean>;
  onCancel: () => void;
  isSaving: boolean;
}

function normalizeDescription(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function ExpenseForm({ users, initialData, existingExpenses, onSave, onCancel, isSaving }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(users[0]?.id || '');
  const [category, setCategory] = useState<Category>('餐饮');
  const [date, setDate] = useState(getTodayDateString());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      setAmount(initialData.amount.toString());
      setPaidBy(initialData.paidBy);
      setCategory(initialData.category || '餐饮');
      setDate(initialData.date);
    } else {
      setDescription('');
      setAmount('');
      setPaidBy(users[0]?.id || '');
      setCategory('餐饮');
      setDate(getTodayDateString());
    }
    setValidationMessage(null);
    setDuplicateConfirmed(false);
    setIsDirty(false);
  }, [initialData, users]);

  const duplicateExpense = useMemo(() => {
    const normalizedDescription = normalizeDescription(description);
    const numericAmount = Number(amount);
    if (!normalizedDescription || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return null;
    }

    return existingExpenses.find((expense) => {
      if (initialData && expense.id === initialData.id) {
        return false;
      }

      return (
        normalizeDescription(expense.description) === normalizedDescription &&
        Number(expense.amount) === numericAmount &&
        expense.paidBy === paidBy &&
        expense.date === date
      );
    }) ?? null;
  }, [amount, date, description, existingExpenses, initialData, paidBy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);

    if (!description.trim()) {
      setValidationMessage('请填写支出描述');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setValidationMessage('请输入大于 0 的金额');
      return;
    }

    if (duplicateExpense && !duplicateConfirmed) {
      setValidationMessage('检测到疑似重复账单，请确认后再保存');
      return;
    }
    
    const expenseData = {
      description: description.trim(),
      amount: numericAmount,
      paidBy,
      category,
      date,
    };

    setValidationMessage(null);
    await onSave(initialData ? { ...expenseData, id: initialData.id } : expenseData);
  };

  const handleClose = () => {
    if (!isDirty || isSaving) {
      onCancel();
      return;
    }

    if (window.confirm('表单还有未保存内容，确认关闭吗？')) {
      onCancel();
    }
  };

  const markDirty = () => {
    if (!isDirty) {
      setIsDirty(true);
    }
    if (duplicateConfirmed) {
      setDuplicateConfirmed(false);
    }
    if (validationMessage) {
      setValidationMessage(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 lg:p-8 flex flex-col gap-4 sm:gap-5">
      <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-1 sm:mb-2">
        {initialData ? '编辑支出' : '记录新支出'}
      </h2>
      <div className="rounded-xl sm:rounded-2xl border border-emerald-100 bg-emerald-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-emerald-800">
        默认按两人平摊，保存后每笔账单都会自动按 50/50 计入结余。
      </div>
      
      <div>
        <label htmlFor="expense-description" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">支出描述</label>
        <input
          id="expense-description"
          type="text"
          value={description}
          onChange={(e) => {
            markDirty();
            setDescription(e.target.value);
          }}
          placeholder="例如：买菜、网费、打车"
          disabled={isSaving}
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white text-sm sm:text-base"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="expense-amount" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">金额 (¥)</label>
          <div className="relative">
            <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">¥</span>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                markDirty();
                setAmount(e.target.value);
              }}
              placeholder="0.00"
              disabled={isSaving}
              className="w-full pl-7 sm:pl-8 pr-3 sm:pr-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white font-medium text-sm"
              required
            />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="expense-paid-by" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">付款人</label>
          <select
            id="expense-paid-by"
            value={paidBy}
            onChange={(e) => {
              markDirty();
              setPaidBy(e.target.value);
            }}
            disabled={isSaving}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white appearance-none text-sm"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1">
          <label htmlFor="expense-category" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">分类</label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => {
              markDirty();
              setCategory(e.target.value as Category);
            }}
            disabled={isSaving}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white appearance-none text-sm"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1">
          <label htmlFor="expense-date" className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">日期</label>
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => {
              markDirty();
              setDate(e.target.value);
            }}
            disabled={isSaving}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white text-sm"
            required
          />
        </div>
      </div>

      {Number.isFinite(Number(amount)) && Number(amount) > 0 && (
        <div className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-slate-600">
          平摊后每人 <span className="font-semibold text-slate-800">¥{(Number(amount) / 2).toFixed(2)}</span>
        </div>
      )}

      {duplicateExpense && (
        <div className="rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs sm:text-sm">疑似重复账单</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-amber-700 truncate">
                「{duplicateExpense.description} / ¥{duplicateExpense.amount.toFixed(2)}」
              </p>
            </div>
          </div>
          <label className="mt-2 sm:mt-3 flex items-start gap-2 text-[10px] sm:text-xs font-medium text-amber-900">
            <input
              type="checkbox"
              checked={duplicateConfirmed}
              disabled={isSaving}
              onChange={(e) => setDuplicateConfirmed(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5"
            />
            <span>确认不是误添加，仍要保存</span>
          </label>
        </div>
      )}

      {validationMessage && (
        <div className="rounded-lg sm:rounded-xl border border-red-200 bg-red-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-red-600">
          {validationMessage}
        </div>
      )}

      <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSaving}
          className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-white py-3 sm:py-3.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 text-sm sm:text-base"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSaving || Boolean(duplicateExpense && !duplicateConfirmed)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 sm:py-3.5 rounded-lg sm:rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 disabled:cursor-not-allowed disabled:bg-emerald-300 text-sm sm:text-base"
        >
          {isSaving ? <LoaderCircle className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : initialData ? <Save className="w-4 h-4 sm:w-5 sm:h-5" /> : <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
          {isSaving ? '保存中...' : initialData ? '保存' : '添加'}
        </button>
      </div>
    </form>
  );
}
