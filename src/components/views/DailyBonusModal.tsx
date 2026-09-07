import React, { useState } from 'react';
import {
  X,
  Gift,
  Flame,
  Coins,
  Zap,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { AnonymousUser } from '../../types.js';
import { api } from '../../services/api.js';

interface DailyBonusModalProps {
  user: AnonymousUser | null;
  onClose: () => void;
  onBonusClaimed: (updatedUser: AnonymousUser, pointsAwarded: number, xpAwarded: number) => void;
}

export const DailyBonusModal: React.FC<DailyBonusModalProps> = ({
  user,
  onClose,
  onBonusClaimed,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardClaimed, setRewardClaimed] = useState<{
    points: number;
    xp: number;
    streak: number;
  } | null>(null);

  const streak = user?.currentStreak || 1;

  const handleClaim = async () => {
    setError(null);
    try {
      setLoading(true);
      const res = await api.claimDailyBonus();
      setRewardClaimed({
        points: res.pointsAwarded,
        xp: res.xpAwarded + res.streakBonusXp,
        streak: res.currentStreak,
      });
      onBonusClaimed(res.user, res.pointsAwarded, res.xpAwarded + res.streakBonusXp);
    } catch (err: any) {
      setError(err.message || 'فشل استلام المكافأة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 gold-metallic-border space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Sparkles */}
        <div className="relative inline-flex items-center justify-center mx-auto mb-1">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-yellow-400/20 border border-amber-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <Gift className="w-10 h-10 text-amber-400 animate-bounce" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black gold-gradient-text">المكافأة اليومية وسلسلة الدخول</h2>
          <p className="text-xs text-neutral-300 mt-1">
            سجل حضورك اليومي كل 24 ساعة لكسب نقاط فورية ومضاعفة رصيد خبرتك.
          </p>
        </div>

        {/* Streak Counter */}
        <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-bold">
          <Flame className="w-4 h-4 text-orange-400" />
          <span>سلسلة أيامك الحالية: {rewardClaimed ? rewardClaimed.streak : streak} أيام متتالية</span>
        </div>

        {/* Reward breakdown */}
        {!rewardClaimed ? (
          <div className="grid grid-cols-2 gap-3 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800">
            <div className="space-y-1">
              <span className="text-xs text-neutral-400">نقاط الرصيد</span>
              <div className="flex items-center justify-center gap-1 text-xl font-black text-amber-300">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>+20</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-neutral-400">نقاط الخبرة (XP)</span>
              <div className="flex items-center justify-center gap-1 text-xl font-black text-blue-300">
                <Zap className="w-4 h-4 text-blue-400" />
                <span>+50</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs space-y-2">
            <div className="flex items-center justify-center gap-2 font-black text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>تهانينا! تم استلام مكافأة اليوم بنجاح</span>
            </div>
            <div className="text-sm font-bold text-amber-300">
              +{rewardClaimed.points} نقطة و +{rewardClaimed.xp} XP
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        {!rewardClaimed ? (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black text-sm shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            {loading ? 'جار الاستلام والتحقق...' : 'استلم مكافأة اليوم الآن'}
          </button>
        ) : (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق ومتابعة المهام
          </button>
        )}
      </div>
    </div>
  );
};
