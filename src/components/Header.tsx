import React from 'react';
import {
  Coins,
  Flame,
  Zap,
  PlusCircle,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  Gift,
  Layers,
} from 'lucide-react';
import { AnonymousUser } from '../types.js';

export type ActiveTab =
  | 'home'
  | 'tasks'
  | 'create-campaign'
  | 'my-campaigns'
  | 'points'
  | 'progress'
  | 'settings'
  | 'admin';

interface HeaderProps {
  user: AnonymousUser | null;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenDailyBonus: () => void;
  canClaimDaily: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  onSelectTab,
  onOpenDailyBonus,
  canClaimDaily,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-amber-500/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 via-amber-600/10 to-transparent border border-amber-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.2)] group-hover:border-amber-400 transition-colors">
            <span className="text-amber-400 font-extrabold text-sm tracking-tighter">AI</span>
          </div>
          <div>
            <div className="font-extrabold text-base sm:text-lg gold-gradient-text leading-tight">
              بروفيسور محمد مهدي AI
            </div>
            <div className="text-[10px] text-amber-200/60 font-medium tracking-wider hidden sm:block">
              تعلم • أنجز • تطور
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'home'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            الرئيسية
          </button>
          <button
            onClick={() => onSelectTab('tasks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>المهام</span>
          </button>
          <button
            onClick={() => onSelectTab('create-campaign')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create-campaign'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>إنشاء حملة</span>
          </button>
          <button
            onClick={() => onSelectTab('my-campaigns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'my-campaigns'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>حملاتي</span>
          </button>
          <button
            onClick={() => onSelectTab('points')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'points'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>نقاطي</span>
          </button>
          <button
            onClick={() => onSelectTab('progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'progress'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                : 'text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/40'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>تقدمي</span>
          </button>
        </nav>

        {/* User Balance & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Create Campaign Trigger */}
          <button
            onClick={() => onSelectTab('create-campaign')}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
              activeTab === 'create-campaign'
                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400'
            }`}
            title="إنشاء حملة متابعين (10 نقاط)"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">حملة (10ن)</span>
          </button>

          {/* Real Server Points Pill */}
          <div
            onClick={() => onSelectTab('points')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/5 border border-amber-400/30 shadow-[0_0_15px_rgba(234,179,8,0.15)] cursor-pointer hover:border-amber-400/60 transition-all"
            title="رصيد النقاط الفعلي المحفوظ في السيرفر"
          >
            <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-tight">
                {user !== null ? user.points.toLocaleString() : '...'}
              </span>
              <span className="text-[9px] text-amber-200/50 leading-none">نقطة</span>
            </div>
          </div>

          {/* XP & Level Badge */}
          <div
            onClick={() => onSelectTab('progress')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-300 cursor-pointer hover:border-neutral-700"
            title="مستوى الخبرة"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-neutral-200">{user?.xp || 0} XP</span>
          </div>

          {/* Streak Badge */}
          {user && user.currentStreak > 0 && (
            <div
              onClick={onOpenDailyBonus}
              className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-400 cursor-pointer"
              title="سلسلة الأيام المتتالية"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{user.currentStreak}</span>
            </div>
          )}

          {/* Admin Dashboard */}
          <button
            onClick={() => onSelectTab('admin')}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(192,132,252,0.3)]'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-purple-300 hover:border-purple-500/30'
            }`}
            title="لوحة الإدارة والمراجعة (Admin Dashboard)"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            onClick={() => onSelectTab('settings')}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title="الإعدادات والخلفية"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
