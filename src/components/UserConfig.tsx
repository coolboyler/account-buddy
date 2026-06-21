import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Settings, User as UserIcon, Check, LoaderCircle } from 'lucide-react';

interface Props {
  users: User[];
  onUpdateUser: (id: string, name: string) => Promise<void>;
  isSaving: boolean;
}

export function UserConfig({ users, onUpdateUser, isSaving }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [name1, setName1] = useState(users[0]?.name || '');
  const [name2, setName2] = useState(users[1]?.name || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName1(users[0]?.name || '');
    setName2(users[1]?.name || '');
  }, [users]);

  const handleSave = async () => {
    if (!name1.trim() || !name2.trim()) {
      setErrorMessage('两个室友名称都需要填写');
      return;
    }

    try {
      setErrorMessage(null);
      await Promise.all([
        onUpdateUser(users[0].id, name1.trim()),
        onUpdateUser(users[1].id, name2.trim()),
      ]);
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存设置失败');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-slate-500 hover:text-slate-800 transition-colors p-2 rounded-full hover:bg-slate-100"
        title="设置"
        aria-label="打开室友设置"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-slate-500" />
            室友设置
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            取消
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label htmlFor="roommate-1-name" className="block text-sm font-medium text-slate-600 mb-1">室友 A 姓名</label>
            <input
              id="roommate-1-name"
              type="text"
              value={name1}
              onChange={(e) => setName1(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label htmlFor="roommate-2-name" className="block text-sm font-medium text-slate-600 mb-1">室友 B 姓名</label>
            <input
              id="roommate-2-name"
              type="text"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              disabled={isSaving}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-xl transition-colors flex items-center gap-2"
          >
            {isSaving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isSaving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>
    </div>
  );
}
