import React from 'react';
import type { User, Expense } from '../types';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { calculateLedgerSummary } from '../lib/ledger';

interface Props {
  users: User[];
  expenses: Expense[];
  onSettleUp: () => void;
  isSettling: boolean;
}

export function BalanceCard({ users, expenses, onSettleUp, isSettling }: Props) {
  if (users.length !== 2) return null;

  const summary = calculateLedgerSummary(users, expenses);
  const debtor = users.find((user) => user.id === summary.debtorId);
  const creditor = users.find((user) => user.id === summary.creditorId);
  let message = "你们已经结清了！";
  if (debtor && creditor && summary.amountOwed > 0) {
    message = `${debtor.name} 欠 ${creditor.name}`;
  }

  return (
    <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-24 sm:w-32 h-24 sm:h-32 bg-emerald-400 rounded-full blur-3xl opacity-20 -ml-8 -mb-8 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-emerald-100/80 font-medium text-xs sm:text-sm uppercase tracking-widest flex items-center gap-2">
            <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            总计结余
          </h2>
          <div className="text-[10px] sm:text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/10 rounded-full text-emerald-50 backdrop-blur-sm">
            两人平摊
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2 mb-4 sm:mb-6 lg:mb-8">
          <span className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
            {summary.amountOwed > 0 ? `¥${summary.amountOwed.toFixed(2)}` : '¥0.00'}
          </span>
          <span className="text-emerald-200 text-xs sm:text-sm font-medium">
            {message}
          </span>
          <span className="text-[10px] sm:text-xs text-emerald-100/80">
            当前未结算账单按 50/50 平摊，人均应承担 ¥{summary.splitPerUser.toFixed(2)}
          </span>
        </div>

        {summary.amountOwed > 0 && (
          <button
            onClick={onSettleUp}
            disabled={isSettling}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 active:scale-[0.98] text-sm sm:text-base"
          >
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            {isSettling ? '结算中...' : '一键结算'}
          </button>
        )}
      </div>
    </div>
  );
}
