import React, { useState } from 'react';
import {
  CheckSquare,
  Coins,
  Zap,
  Clock,
  ExternalLink,
  Filter,
  CheckCircle2,
  Hourglass,
  Sparkles,
  Instagram,
} from 'lucide-react';
import { Task, TaskType } from '../../types.js';
import { AccountCard } from '../AccountCard.js';

interface TasksViewProps {
  tasks: (Task & {
    userCompletionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    userCompletionId: string | null;
  })[];
  onSelectTask: (task: any) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, onSelectTask }) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredTasks = tasks.filter((t) => {
    if (typeFilter !== 'ALL' && t.taskType !== typeFilter) return false;
    if (statusFilter === 'AVAILABLE' && t.userCompletionStatus !== null) return false;
    if (statusFilter === 'PENDING' && t.userCompletionStatus !== 'PENDING') return false;
    if (statusFilter === 'APPROVED' && t.userCompletionStatus !== 'APPROVED') return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">قائمة المهام المتاحة</h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            أنجز المهام المتاحة واكسب +1 نقطة عن كل مهمة مكتملة ومعتمدة. كل 10 نقاط تمكنك من إنشاء حملة متابعين جديدة!
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-900/60 px-3 py-1.5 rounded-xl border border-neutral-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>إجمالي المهام المتاحة: {tasks.length}</span>
        </div>
      </div>

      {/* Filters (Task Types & Completion Status) */}
      <div className="space-y-3">
        {/* Task Type Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'كافة المهام' },
            { id: 'FOLLOWERS', label: 'متابعين (Followers)' },
            { id: 'VISIT_URL', label: 'زيارة روابط' },
            { id: 'WATCH_CONTENT', label: 'مشاهدة محتوى' },
            { id: 'READ_ARTICLE', label: 'قراءة مقالات' },
            { id: 'COMPLETE_QUIZ', label: 'اختبارات قصيرة' },
            { id: 'SURVEY', label: 'استبيانات' },
            { id: 'LEARNING_TASK', label: 'مهام تعليمية' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setTypeFilter(type.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === type.id
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(234,179,8,0.15)]'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          {[
            { id: 'ALL', label: 'الكل' },
            { id: 'AVAILABLE', label: 'المتاحة للإنجاز' },
            { id: 'PENDING', label: 'قيد المراجعة' },
            { id: 'APPROVED', label: 'المكتملة' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-neutral-800 text-white border border-neutral-600'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl glass-panel p-10 text-center gold-metallic-border space-y-3">
          <CheckSquare className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">لا توجد مهام مطابقة للفلتر المحدد</h3>
          <p className="text-xs text-neutral-400">جرب اختيار تصنيف آخر أو تحقق من المهام الجديدة لاحقاً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const status = task.userCompletionStatus;
            const isInstagram = task.platform?.toLowerCase().includes('insta');
            const currentCompletions = task.currentCompletions || 0;
            const targetCompletions = task.totalCompletionsRequired || 50;
            const progressPct = Math.min(100, Math.round((currentCompletions / targetCompletions) * 100));

            return (
              <div
                key={task.id}
                className="rounded-2xl glass-panel p-4 gold-metallic-border glass-panel-hover flex flex-col justify-between gap-3 relative overflow-hidden"
              >
                {/* 1. Header: Platform / Task Type */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400">
                      {isInstagram ? 'متابعين Instagram' : 'متابعين TikTok'}
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                      {task.taskType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <Clock className="w-3 h-3 text-neutral-500" />
                    <span>{task.durationMinutes || 1} د</span>
                  </div>
                </div>

                {/* 2. Small & Elegant Campaign Owner Card (Requirement #1) */}
                <div className="space-y-1">
                  <AccountCard
                    platform={task.platform}
                    username={task.targetUsername || ''}
                    displayName={task.targetDisplayName}
                    avatarUrl={task.targetAvatarUrl}
                    isVerified={task.isAccountVerified}
                    showFollowButton={true}
                  />
                </div>

                {/* 3. Task Completion Action Button (Requirement #5) */}
                <div>
                  {status === 'APPROVED' ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>مكتملة ومكافأة مودعة</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">+1 نقطة</span>
                    </div>
                  ) : status === 'PENDING' ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <Hourglass
                          className="w-4 h-4 text-yellow-400 animate-spin shrink-0"
                          style={{ animationDuration: '4s' }}
                        />
                        <span>قيد المراجعة والاعتماد</span>
                      </div>
                      <span className="font-mono text-yellow-400 text-[11px]">انتظار</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-neutral-950 font-black text-xs shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-neutral-950 shrink-0" />
                      <span>إكمال المهمة (+1 نقطة)</span>
                    </button>
                  )}
                </div>

                {/* 4. Progress & Reward */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 text-[11px]">
                      التقدم: <strong className="text-neutral-200">{currentCompletions} / {targetCompletions}</strong>
                    </span>
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-400" />
                      <span>المكافأة: +{task.reward || 1} نقطة</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
