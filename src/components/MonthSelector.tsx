import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface Props {
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
}

export function MonthSelector({ currentMonth, onChangeMonth }: Props) {
  const handlePrevMonth = () => onChangeMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => onChangeMonth(addMonths(currentMonth, 1));
  const handleCurrentMonth = () => onChangeMonth(new Date());

  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 mb-6">
      <button
        onClick={handlePrevMonth}
        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      
      <div className="flex items-center gap-3">
        <CalendarIcon className="w-5 h-5 text-emerald-500" />
        <span className="text-lg font-semibold text-slate-800 tracking-wide">
          {format(currentMonth, 'yyyy年M月', { locale: zhCN })}
        </span>
        {!isCurrentMonth && (
          <button
            onClick={handleCurrentMonth}
            className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
          >
            回到本月
          </button>
        )}
      </div>

      <button
        onClick={handleNextMonth}
        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
