import React, { useState } from 'react';
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet,
  Lock,
  Layers,
  History,
  Tag,
} from 'lucide-react';
import { PointTransaction, PointTransactionType } from '../../types.js';

interface MyPointsViewProps {
  currentPoints: number;
  earnedTotal: number;
  spentTotal: number;
  lockedCampaignBudget: number;
  transactions: PointTransaction[];
  onRefresh: () => void;
  loading: boolean;
}

export const MyPointsView: React.FC<MyPointsViewProps> = ({
  currentPoints,
  earnedTotal,
  spentTotal,
  lockedCampaignBudget,
  transactions,
  onRefresh,
  loading,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.type === filterType;
  });

  const getBadgeForType = (type: PointTransactionType) => {
    switch (type) {
      case 'TASK_REWARD':
        return {
          label: 'مكافأة مهمة (Task Reward)',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          icon: ArrowUpRight,
        };
      case 'CAMPAIGN_COST':
        return {
          label: 'تكلفة حملة (Campaign Created)',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          icon: ArrowDownLeft,
        };
      case 'CAMPAIGN_REFUND':
        return {
          label: 'استرجاع ميزانية (Campaign Refund)',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          icon: RefreshCw,
        };
      case 'FIRST_CAMPAIGN_BONUS':
        return {
          label: 'مكافأة أول حملة (First Campaign Bonus)',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: Coins,
        };
      case 'DAILY_BONUS':
        return {
          label: 'مكافأة ترحيبية / يومية (Bonus)',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: Coins,
        };
      case 'ADMIN_ADJUSTMENT':
        return {
          label: 'تعديل إداري (Admin Adjustment)',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          icon: Tag,
        };
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">محفظة النقاط وسجل المعاملات</h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            نظام نقاط سيرفر حقيقي وموثق بالكامل مع دفتر حسابات غير قابل للتلاعب.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-amber-300 hover:border-amber-400/40 text-xs font-semibold cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الرصيد</span>
        </button>
      </div>

      {/* 4 Summary Cards (Requirement #16) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Current Points */}
        <div className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span>الرصيد المتاح (Current)</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">
            {currentPoints.toLocaleString()}{' '}
            <span className="text-xs font-normal text-neutral-400">نقطة</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">جاهز لإنشاء حملات جديدة</p>
        </div>

        {/* Earned Points */}
        <div className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span>إجمالي المكتسب (Earned)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300">
            +{earnedTotal.toLocaleString()}{' '}
            <span className="text-xs font-normal text-neutral-400">نقطة</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">من المهام ومكافأة البداية</p>
        </div>

        {/* Spent Points */}
        <div className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span>إجمالي المصروف (Spent)</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-300">
            -{spentTotal.toLocaleString()}{' '}
            <span className="text-xs font-normal text-neutral-400">نقطة</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">تم توظيفها في تمويل حملات</p>
        </div>

        {/* Locked Campaign Budget */}
        <div className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-2">
            <span>ميزانية الحملات (Locked)</span>
            <Lock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-300">
            {lockedCampaignBudget.toLocaleString()}{' '}
            <span className="text-xs font-normal text-neutral-400">نقطة</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">محجوزة بحملاتك النشطة</p>
        </div>
      </div>

      {/* Transaction History Section (Requirement #16) */}
      <div className="rounded-2xl glass-panel p-5 gold-metallic-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">سجل حركات النقاط (Point Ledger)</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
              {transactions.length} حركة
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['ALL', 'TASK_REWARD', 'CAMPAIGN_COST', 'FIRST_CAMPAIGN_BONUS', 'CAMPAIGN_REFUND'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterType === t
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'text-neutral-400 hover:text-neutral-200 bg-neutral-900/60'
                }`}
              >
                {t === 'ALL'
                  ? 'الكل'
                  : t === 'TASK_REWARD'
                  ? 'مكافآت المهام'
                  : t === 'CAMPAIGN_COST'
                  ? 'تكاليف الحملات'
                  : t === 'FIRST_CAMPAIGN_BONUS'
                  ? 'مكافأة أول حملة'
                  : 'الاسترجاع'}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 space-y-2">
            <Coins className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-xs">لا توجد حركات مسجلة في هذا القسم بعد.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/80">
            {filteredTransactions.map((tx) => {
              const badge = getBadgeForType(tx.type);
              const isPositive = tx.amount > 0;
              const formattedDate = new Date(tx.createdAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${badge.color}`}
                    >
                      <badge.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white line-clamp-1">{tx.description}</span>
                        <span
                          className={`hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                        <span className="font-mono text-[11px]">{formattedDate}</span>
                        <span>•</span>
                        <span>
                          الرصيد: {tx.balanceBefore} ← {tx.balanceAfter} نقطة
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <div
                      className={`text-base sm:text-lg font-black ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+${tx.amount}` : tx.amount}
                    </div>
                    <span className="text-[10px] text-neutral-400">نقطة</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
