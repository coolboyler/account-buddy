import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  count: number;
  title: string;
  description: string;
}

export function SettleUpModal({ isOpen, onConfirm, onCancel, isPending, count, title, description }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <p className="text-slate-500 text-sm mt-2">
              {description}
            </p>
            <p className="text-xs text-slate-400 mt-3">本次将处理 {count} 笔未结算账单。</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            {isPending ? '结算中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
