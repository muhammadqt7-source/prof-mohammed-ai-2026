import React from 'react';
import {
  Zap,
  Award,
  Flame,
  CheckCircle2,
  Gift,
  Shield,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';
import { AnonymousUser, LEVEL_THRESHOLDS } from '../../types.js';

interface MyProgressViewProps {
  user: AnonymousUser | null;
  progressPercent: number;
  xpForNext: number;
  onOpenDailyBonus: () => void;
  canClaimDaily: boolean;
}

export const MyProgressView: React.FC<MyProgressViewProps> = ({
  user,
  progressPercent,
  xpForNext,
  onOpenDailyBonus,
  canClaimDaily,
}) => {
  const currentXP = user?.xp || 0;
  const currentLevel = user?.level || 'BEGINNER';
  const streak = user?.currentStreak ?? 0;

  const milestones = [
    { days: 3, xp: 10, label: '3 أيام متتالية' },
    { days: 7, xp: 50, label: 'أسبوع كامل (7 أيام)' },
    { days: 14, xp: 100, label: 'أسبوعان (14 يوماً)' },
    { days: 30, xp: 300, label: 'شهر كامل (30 يوماً)' },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">مستويات الخبرة والتطور (XP)</h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            ارفع رتبتك الأكاديمية بنظام نقاط الخبرة الحقيقي وافتح امتيازات حصرية للمهام والحملات.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs font-bold text-amber-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>المعادلة: 10 مهام = حملة جديدة (10 نقاط)</span>
        </div>
      </div>

      {/* Main XP Status Card */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/30 via-yellow-500/20 to-blue-500/20 border border-amber-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.25)]">
              <Award className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">الرتبة الحالية:</span>
                <span className="text-lg font-black text-amber-300">{currentLevel}</span>
              </div>
              <div className="text-2xl font-black text-white mt-0.5">
                {currentXP.toLocaleString()} <span className="text-sm font-bold text-blue-400">XP</span>
              </div>
            </div>
          </div>

          <div className="text-right sm:text-left bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
            <span className="text-xs text-neutral-400 block">المتبقي للترقية القادمة</span>
            <span className="text-base font-extrabold text-blue-300">
              {xpForNext > 0 ? `${xpForNext.toLocaleString()} XP` : 'وصلت لأعلى رتبة!'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span>التقدم في هذا المستوى</span>
            <span className="font-extrabold text-amber-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-yellow-300 transition-all duration-700 shadow-[0_0_10px_#eab308]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily Streak Milestone Section (Requirement #13) */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <h2 className="text-base font-bold text-white">سلسلة الأيام المتتالية (Daily Streak)</h2>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/30">
            <span>سلسلتك الحالية: {streak} يوم</span>
          </div>
        </div>

        <p className="text-xs text-neutral-300">
          حافظ على دخولك اليومي لاستلام مكافآت XP مضاعفة عند بلوغ محطات السلسلة:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {milestones.map((m) => {
            const isReached = streak >= m.days;
            return (
              <div
                key={m.days}
                className={`p-4 rounded-xl border text-center transition-all ${
                  isReached
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                }`}
              >
                <div className="flex justify-center mb-1.5">
                  {isReached ? (
                    <CheckCircle2 className="w-5 h-5 text-orange-400" />
                  ) : (
                    <Flame className="w-5 h-5 text-neutral-600" />
                  )}
                </div>
                <div className="text-xs font-bold">{m.label}</div>
                <div className="text-base font-black text-amber-300 mt-1">+{m.xp} XP</div>
                <div className="text-[10px] mt-1 text-neutral-400">
                  {isReached ? 'تم البلوغ بنجاح' : `متبقي ${Math.max(0, m.days - streak)} يوم`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Levels & Hierarchy Ladder (Requirement #12) */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <span>جدول رتب ومستويات بروفيسور محمد مهدي AI</span>
        </h2>

        <div className="space-y-3">
          {LEVEL_THRESHOLDS.map((lvl) => {
            const isCurrent = currentLevel === lvl.level;
            const isUnlocked = currentXP >= lvl.minXP;

            return (
              <div
                key={lvl.level}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]'
                    : isUnlocked
                    ? 'bg-neutral-900/50 border-neutral-800 text-neutral-300'
                    : 'bg-neutral-950/40 border-neutral-900 text-neutral-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border"
                    style={{
                      borderColor: lvl.badgeColor,
                      backgroundColor: `${lvl.badgeColor}22`,
                      color: lvl.badgeColor,
                    }}
                  >
                    {lvl.level.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">
                        {lvl.labelAr} ({lvl.level})
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-neutral-950">
                          رتبتك الحالية
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5 font-mono">
                      الحد الأدنى: {lvl.minXP.toLocaleString()} XP
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-300">
                  {lvl.perks.map((perk, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md bg-neutral-800/80 border border-neutral-700/60 text-[11px]"
                    >
                      {perk}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
