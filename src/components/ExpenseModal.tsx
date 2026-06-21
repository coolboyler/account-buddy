import React from 'react';
import { ExpenseForm } from './ExpenseForm';
import type { User, Expense, ExpenseDraft } from '../types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  initialData?: Expense | null;
  existingExpenses: Expense[];
  onSaveExpense: (expense: ExpenseDraft | Expense) => Promise<boolean>;
  isSaving: boolean;
}

export function ExpenseModal({ isOpen, onClose, users, initialData, existingExpenses, onSaveExpense, isSaving }: Props) {
  if (!isOpen) return null;

  const handleSave = async (expenseData: ExpenseDraft | Expense) => {
    const saved = await onSaveExpense(expenseData);
    if (saved) {
      onClose();
    }
    return saved;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-none overflow-auto border border-slate-100 relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 safe-area-bottom">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
          aria-label="关闭支出弹窗"
        >
          <X className="w-5 h-5" />
        </button>
        <ExpenseForm
          users={users}
          initialData={initialData}
          existingExpenses={existingExpenses}
          onSave={handleSave}
          onCancel={onClose}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
