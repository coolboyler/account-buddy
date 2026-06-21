import React from 'react';
import type { Expense, Category, User } from '../types';
import { PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { calculateLedgerSummary } from '../lib/ledger';

interface Props {
  expenses: Expense[];
  unsettledExpenses: Expense[];
  users: User[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  '餐饮': '#f97316', // orange-500
  '购物': '#ec4899', // pink-500
  '居住': '#3b82f6', // blue-500
  '交通': '#6366f1', // indigo-500
  '娱乐': '#a855f7', // purple-500
  '其他': '#64748b', // slate-500
};

export function SummaryStats({ expenses, unsettledExpenses, users }: Props) {
  const summary = calculateLedgerSummary(users, expenses);
  const unsettledSummary = calculateLedgerSummary(users, unsettledExpenses);

  const chartData = Object.entries(summary.categoryTotals)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100">
      <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4 sm:mb-6 flex items-center gap-2">
        <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
        月度总结
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-1 font-medium truncate">{users[0]?.name} 支付</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800">¥{(summary.userPaidTotals[users[0]?.id ?? ''] ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
          <p className="text-[10px] sm:text-xs text-slate-500 mb-1 font-medium truncate">{users[1]?.name} 支付</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800">¥{(summary.userPaidTotals[users[1]?.id ?? ''] ?? 0).toFixed(2)}</p>
        </div>
        <div className="col-span-2 bg-emerald-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-emerald-600 mb-1 font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              本月总支出
            </p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-900">¥{summary.totalExpenses.toFixed(2)}</p>
          </div>
        </div>
        <div className="col-span-2 bg-amber-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-amber-700 mb-1 font-medium">按两人平摊后</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-900">人均 ¥{summary.splitPerUser.toFixed(2)}</p>
          </div>
          <span className="rounded-full bg-white/80 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-amber-700">
            AA 分摊
          </span>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-slate-500">未结算笔数</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-slate-800">{unsettledExpenses.length}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-slate-500">未结算总额</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-slate-800">¥{unsettledSummary.totalExpenses.toFixed(2)}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-slate-500">未结算人均</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-slate-800">¥{unsettledSummary.splitPerUser.toFixed(2)}</p>
          </div>
        </div>
        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {users.map((user) => {
            const paid = unsettledSummary.userPaidTotals[user.id] ?? 0;
            const net = unsettledSummary.userNetBalances[user.id] ?? 0;

            return (
              <div key={user.id} className="rounded-xl sm:rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                  <span className={`rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold ${
                    net > 0.01
                      ? 'bg-emerald-100 text-emerald-700'
                      : net < -0.01
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {net > 0.01 ? '应收' : net < -0.01 ? '应付' : '已平'}
                  </span>
                </div>
                <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between rounded-lg sm:rounded-xl bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2">
                    <p className="text-slate-500">已支付</p>
                    <p className="font-semibold text-slate-800">¥{paid.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg sm:rounded-xl bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2">
                    <p className="text-slate-500">应承担</p>
                    <p className="font-semibold text-slate-800">¥{unsettledSummary.splitPerUser.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg sm:rounded-xl bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2">
                    <p className="text-slate-500">{net >= 0 ? '应收' : '应付'}</p>
                    <p className="font-semibold text-slate-800">¥{Math.abs(net).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {summary.totalExpenses > 0 ? (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3 sm:mb-4">分类占比</p>
          <div className="h-40 sm:h-48 w-full mb-3 sm:mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name as Category] || CATEGORY_COLORS['其他']} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `¥${value.toFixed(2)}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {chartData.map((entry) => {
              const percentage = ((entry.value / summary.totalExpenses) * 100).toFixed(1);
              const colorClass = CATEGORY_COLORS[entry.name as Category] || CATEGORY_COLORS['其他'];

              return (
                <div key={entry.name} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: colorClass }}></div>
                    <span className="text-slate-700 font-medium">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-slate-400 text-[10px] sm:text-xs w-8 sm:w-10 text-right">{percentage}%</span>
                    <span className="text-slate-800 font-semibold w-14 sm:w-16 text-right">¥{entry.value.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 sm:py-8 text-slate-400 text-xs sm:text-sm bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
          本月暂无分类数据
        </div>
      )}
    </div>
  );
}
