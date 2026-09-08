import React from 'react';
import {
  Coins,
  Zap,
  Award,
  Flame,
  CheckCircle2,
  Layers,
  ArrowLeft,
  PlusCircle,
  Sparkles,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { AnonymousUser, Campaign, Task } from '../../types.js';
import { ActiveTab } from '../Header.js';
import { AccountCard } from '../AccountCard.js';

interface HomeViewProps {
  user: AnonymousUser | null;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenDailyBonus: () => void;
  canClaimDaily: boolean;
  tasks: Task[];
  campaigns: Campaign[];
  onOpenTask: (task: Task) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  onSelectTab,
  onOpenDailyBonus,
  canClaimDaily,
  tasks,
  campaigns,
  onOpenTask,
}) => {
  const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE');

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Hero AI Lab Display (Matching Professor AI Hologram aesthetic) */}
      <div className="relative rounded-2xl glass-panel p-6 sm:p-8 gold-metallic-border overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>المنصة الذكية المتطورة لإدارة الحملات والنقاط</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold gold-gradient-text tracking-wide leading-tight">
              بروفيسور محمد مهدي AI
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 font-medium leading-relaxed">
              تعلم • أنجز • تطور — اكسب نقاطاً حقيقية عبر تنفيذ المهام، وأنشئ حملاتك الترويجية والتعليمية بميزانيات مستقلة وحماية برمجية متكاملة.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-neutral-400">معرفك الذكي:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-neutral-900/80 border border-neutral-800 text-[11px] font-mono text-amber-300/80">
                {user?.id || 'جار التحميل...'}
              </span>
            </div>
          </div>

          {/* Campaign Hub Hero Callout */}
          <div className="w-full md:w-auto shrink-0">
            <div
              onClick={() => onSelectTab('create-campaign')}
              className="p-4 rounded-xl border transition-all cursor-pointer text-center relative overflow-hidden group bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border-amber-400 shadow-[0_0_25px_rgba(234,179,8,0.25)] hover:border-amber-300"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Layers className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">
                  حملات متابعين TikTok و Instagram
                </span>
              </div>
              <div className="text-lg font-extrabold text-white mb-1">
                10 نقاط = حملة واحدة
              </div>
              <p className="text-[11px] text-neutral-300">
                إنجاز 10 مهام (+1 نقطة) = إنشاء حملة متابعين جديدة
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 text-xs font-black text-amber-300 bg-amber-400/20 px-3 py-1 rounded-lg border border-amber-400/30 group-hover:bg-amber-400/30">
                <span>إنشاء حملة الآن</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mandatory Cards (Points, Campaign Cost, Task Reward, Level, Completed Tasks, Active Campaigns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Points Card */}
        <div
          onClick={() => onSelectTab('points')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">رصيد النقاط</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-300">
              {user ? user.points.toLocaleString() : '0'}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">رصيد السيرفر الفعلي</div>
          </div>
        </div>

        {/* Campaign Cost Card */}
        <div
          onClick={() => onSelectTab('create-campaign')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">تكلفة الحملة</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white">
              50 <span className="text-xs font-normal text-amber-300">نقطة</span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">تكلفة ثابتة للحملة</div>
          </div>
        </div>

        {/* Task Reward Card */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">مكافأة المهمة</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300">
              +1 <span className="text-xs font-normal text-neutral-400">نقطة</span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">لكل مهمة معتمدة</div>
          </div>
        </div>

        {/* Level Card */}
        <div
          onClick={() => onSelectTab('progress')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">المستوى</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-base sm:text-lg font-extrabold text-purple-300">
              {user?.level || 'BEGINNER'}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">الرتبة في المنصة</div>
          </div>
        </div>

        {/* Completed Tasks Card */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">المهام المنجزة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300">
              {user?.completedTasksCount || 0}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">إنجازات معتمدة</div>
          </div>
        </div>

        {/* Active Campaigns Card */}
        <div
          onClick={() => onSelectTab('my-campaigns')}
          className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium">الحملات النشطة</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-300">
              {activeCampaigns.length}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">حملات قيد التشغيل</div>
          </div>
        </div>
      </div>

      {/* 3. Mandatory Buttons (Requirement #15: المهام, إنشاء حملة, نقاطي, تقدمي) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => onSelectTab('tasks')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-500/10 border border-blue-500/30 text-blue-300 font-bold text-sm hover:border-blue-400 transition-all cursor-pointer shadow-md hover:scale-[1.02]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>المهام</span>
        </button>

        <button
          onClick={() => onSelectTab('create-campaign')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-yellow-600/15 border border-amber-400/50 text-amber-300 font-bold text-sm hover:border-amber-300 transition-all cursor-pointer shadow-[0_0_15px_rgba(234,179,8,0.2)] hover:scale-[1.02]"
        >
          <PlusCircle className="w-4 h-4 text-amber-400" />
          <span>إنشاء حملة</span>
        </button>

        <button
          onClick={() => onSelectTab('points')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-amber-700/10 border border-amber-500/30 text-amber-300 font-bold text-sm hover:border-amber-400 transition-all cursor-pointer shadow-md hover:scale-[1.02]"
        >
          <Coins className="w-4 h-4" />
          <span>نقاطي</span>
        </button>

        <button
          onClick={() => onSelectTab('progress')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-purple-500/10 border border-purple-500/30 text-purple-300 font-bold text-sm hover:border-purple-400 transition-all cursor-pointer shadow-md hover:scale-[1.02]"
        >
          <BarChart3 className="w-4 h-4" />
          <span>تقدمي</span>
        </button>
      </div>

      {/* 4. Active Tasks Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>مهام الذكاء الاصطناعي النشطة</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {tasks.length} مهام متاحة
              </span>
            </h2>
            <p className="text-xs text-neutral-400">نفذ المهام واكسب رصيد نقاط وخبرة معتمدة فورياً</p>
          </div>
          <button
            onClick={() => onSelectTab('tasks')}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            <span>عرض الكل</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.slice(0, 4).map((task) => (
            <div
              key={task.id}
              onClick={() => onOpenTask(task)}
              className="glass-panel p-4 rounded-xl gold-metallic-border glass-panel-hover cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {task.taskType}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5 line-clamp-1">{task.title}</h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 mt-1">{task.description}</p>
                </div>
                <div className="text-left shrink-0">
                  <div className="flex items-center gap-1 text-amber-300 font-extrabold text-sm">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>+{task.reward || 1} نقطة</span>
                  </div>
                  {task.xpReward > 0 && (
                    <div className="text-[10px] text-blue-300 font-semibold">+{task.xpReward} XP</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
                <span className="text-neutral-400 text-[11px]">{task.platform}</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1 hover:underline">
                  <span>فتح وتفاصيل</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Live Community Campaigns Showcase */}
      {activeCampaigns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>حملات المجتمع النشطة</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {activeCampaigns.length} حملة جارية
                </span>
              </h2>
              <p className="text-xs text-neutral-400">حملات أنشأها المستخدمون بميزانيات حقيقية</p>
            </div>
            <button
              onClick={() => onSelectTab('my-campaigns')}
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              <span>حملاتي</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCampaigns.slice(0, 3).map((camp) => {
              const progressPct = Math.min(
                100,
                Math.round((camp.currentProgress / camp.targetCompletions) * 100)
              );
              const matchingTask = tasks.find((t) => t.campaignId === camp.id);

              return (
                <div
                  key={camp.id}
                  className="glass-panel p-4 rounded-xl gold-metallic-border flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-amber-400 font-bold">{camp.platform}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        نشطة
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{camp.title}</h3>
                    <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{camp.description}</p>
                  </div>

                  {/* Target Account Card (Requirement #7) */}
                  {(camp.targetUsername || camp.platform === 'TikTok' || camp.platform === 'Instagram') && (
                    <AccountCard
                      platform={camp.platform}
                      username={camp.targetUsername || ''}
                      displayName={camp.targetDisplayName}
                      avatarUrl={camp.targetAvatarUrl}
                      targetUrl={camp.targetUrl}
                      isVerified={camp.isAccountVerified}
                      showFollowHint={true}
                    />
                  )}

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">الإنجاز:</span>
                      <span className="font-bold text-neutral-200">
                        {camp.currentProgress} / {camp.targetCompletions}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span className="text-emerald-400 font-bold">المكافأة: +{camp.rewardPerCompletion} نقطة</span>
                      <span className="text-amber-300">المتبقي: {camp.remainingBudget} نقطة</span>
                    </div>

                    {matchingTask && (
                      <button
                        onClick={() => onOpenTask(matchingTask)}
                        className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        <span>تنفيذ المهمة وكسب +1 نقطة</span>
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
