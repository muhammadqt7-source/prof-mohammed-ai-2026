import React, { useState } from 'react';
import {
  Layers,
  Clock,
  Coins,
  Pause,
  Play,
  XCircle,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Campaign, CampaignStatus } from '../../types.js';
import { api } from '../../services/api.js';
import { AccountCard } from '../AccountCard.js';

interface MyCampaignsViewProps {
  campaigns: Campaign[];
  onRefresh: () => void;
  onCreateNew: () => void;
  onCampaignUpdated: (updated: Campaign, newBalance?: number) => void;
}

export const MyCampaignsView: React.FC<MyCampaignsViewProps> = ({
  campaigns,
  onRefresh,
  onCreateNew,
  onCampaignUpdated,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | 'ALL'>('ALL');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = campaigns.filter((c) => {
    if (selectedStatus === 'ALL') return true;
    return c.status === selectedStatus;
  });

  const handleTogglePause = async (campaign: Campaign) => {
    try {
      setLoadingActionId(campaign.id);
      const res = await api.pauseCampaign(campaign.id);
      setFeedback(res.campaign.status === 'PAUSED' ? 'تم إيقاف الحملة مؤقتاً' : 'تم استئناف تشغيل الحملة');
      onCampaignUpdated(res.campaign);
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCancelCampaign = async (campaign: Campaign) => {
    if (
      !confirm(
        `هل أنت متأكد من رغبتك في إلغاء هذه الحملة؟ سيتم استرجاع الميزانية المتبقية (${campaign.remainingBudget} نقطة) فورياً إلى رصيدك.`
      )
    ) {
      return;
    }

    try {
      setLoadingActionId(campaign.id);
      const res = await api.cancelCampaign(campaign.id);
      setFeedback(res.message);
      onCampaignUpdated(res.campaign, res.userBalance);
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setLoadingActionId(null);
    }
  };

  const getTimeRemaining = (expiresAt: string, status: CampaignStatus) => {
    if (status !== 'ACTIVE' && status !== 'PAUSED') return status;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'منتهية الصلاحية';
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `متبقي ${hours} ساعة و ${mins % 60} دقيقة`;
    return `متبقي ${mins} دقيقة`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">إدارة حملاتي</h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            متابعة فورية لتقدم إنجازات حملاتك، الميزانية المصروفة والمتبقية مع استرجاع النقاط تلقائياً.
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black text-xs shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-[1.02] cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إنشاء حملة جديدة</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-white text-xs">
            إغلاق
          </button>
        </div>
      )}

      {/* Filter Tabs (Requirement #17: Active, Completed, Expired, Cancelled) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['ALL', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const).map((st) => {
          const labels: Record<string, string> = {
            ALL: 'الكل',
            ACTIVE: 'النشطة (Active)',
            COMPLETED: 'المكتملة (Completed)',
            EXPIRED: 'المنتهية (Expired)',
            CANCELLED: 'الملغاة (Cancelled)',
          };
          const count =
            st === 'ALL'
              ? campaigns.length
              : campaigns.filter((c) => c.status === st).length;

          return (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatus === st
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {labels[st]} ({count})
            </button>
          );
        })}
      </div>

      {/* Campaigns Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel p-10 text-center gold-metallic-border space-y-4">
          <Layers className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">لا توجد حملات في هذا التصنيف</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            أنشئ أول حملة ذكية لك وقم بتوزيع المهام والمكافآت للمستخدمين عبر المنصة.
          </p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إنشاء حملة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((camp) => {
            const progressPct = Math.min(
              100,
              Math.round((camp.currentProgress / camp.targetCompletions) * 100)
            );
            const isFinished =
              camp.status === 'COMPLETED' || camp.status === 'EXPIRED' || camp.status === 'CANCELLED';

            return (
              <div
                key={camp.id}
                className="rounded-2xl glass-panel p-5 gold-metallic-border flex flex-col justify-between gap-4"
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-amber-400">{camp.platform}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        camp.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                          : camp.status === 'COMPLETED'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : camp.status === 'EXPIRED'
                          ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          : camp.status === 'PAUSED'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-1">{camp.title}</h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 mt-1">{camp.description}</p>
                </div>

                {/* Target Account Card Preview */}
                {(camp.targetUsername || camp.platform === 'TikTok' || camp.platform === 'Instagram') && (
                  <AccountCard
                    platform={camp.platform}
                    username={camp.targetUsername || ''}
                    displayName={camp.targetDisplayName}
                    avatarUrl={camp.targetAvatarUrl}
                    targetUrl={camp.targetUrl}
                    isVerified={camp.isAccountVerified}
                    showFollowHint={false}
                  />
                )}

                {/* Progress & Budget Stats (Requirement #17) */}
                <div className="space-y-2 bg-neutral-950/40 p-3.5 rounded-xl border border-neutral-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-medium">Progress (نسبة الإنجاز):</span>
                    <span className="font-extrabold text-amber-300">
                      {camp.currentProgress} / {camp.targetCompletions} إنجاز ({progressPct}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-neutral-800">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">الميزانية الكلية</span>
                      <span className="font-bold text-white">{camp.totalBudget} نقطة</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">المصروف</span>
                      <span className="font-bold text-neutral-300">{camp.spentBudget} نقطة</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 block">المتبقي</span>
                      <span className="font-bold text-amber-300">{camp.remainingBudget} نقطة</span>
                    </div>
                  </div>
                </div>

                {/* Time Remaining & Controls */}
                <div className="flex items-center justify-between pt-1 text-xs border-t border-neutral-800">
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{getTimeRemaining(camp.expiresAt, camp.status)}</span>
                  </div>

                  {/* Actions (Pause / Cancel) */}
                  {!isFinished && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePause(camp)}
                        disabled={loadingActionId === camp.id}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                        title={camp.status === 'ACTIVE' ? 'إيقاف مؤقت' : 'استئناف'}
                      >
                        {camp.status === 'ACTIVE' ? (
                          <Pause className="w-3.5 h-3.5 text-yellow-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </button>

                      <button
                        onClick={() => handleCancelCampaign(camp)}
                        disabled={loadingActionId === camp.id}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title="إلغاء واسترجاع الميزانية المتبقية فورياً"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>إلغاء واسترجاع</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
