import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Coins,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { Task } from '../../types.js';
import { api } from '../../services/api.js';
import { AccountCard } from '../AccountCard.js';

interface TaskDetailsModalProps {
  task: Task & {
    userCompletionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    userCompletionId: string | null;
  };
  onClose: () => void;
  onSubmitted: (completion: any) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  onClose,
  onSubmitted,
}) => {
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const status = task.userCompletionStatus;
  const isAlreadySubmitted = status === 'PENDING' || status === 'APPROVED';

  // Strict official URL derived directly from targetUsername
  const rawUsername = task.targetUsername || '';
  const cleanUsername = rawUsername.replace(/^@+/, '').trim();
  const isInstagram = task.platform?.toLowerCase().includes('insta');
  const officialUrl = cleanUsername
    ? (isInstagram
        ? `https://www.instagram.com/${cleanUsername}`
        : `https://www.tiktok.com/@${cleanUsername}`)
    : task.targetUrl;

  const handleOpenTaskUrl = () => {
    if (officialUrl) {
      window.open(officialUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setSubmitting(true);
      const res = await api.submitTask(task.id, proofNote);
      setSuccessMessage(res.message);
      setTimeout(() => {
        onSubmitted(res.completion);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل إرسال الإنجاز');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 gold-metallic-border space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pr-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
              {task.taskType}
            </span>
            <span className="text-xs text-neutral-400 font-medium">{task.platform}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">{task.title}</h2>
        </div>

        {/* Reward & Meta Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 text-center">
          <div>
            <span className="text-[10px] text-neutral-400 block">المكافأة المعتمدة</span>
            <div className="flex items-center justify-center gap-1 font-black text-amber-300 text-sm mt-0.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>+{task.reward || 1} نقطة</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 block">نوع المهمة</span>
            <div className="flex items-center justify-center gap-1 font-bold text-neutral-300 text-xs mt-0.5">
              <span>{task.taskType === 'FOLLOWERS' ? 'متابعة حساب' : task.taskType}</span>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] text-neutral-400 block">المدة المقدرة</span>
            <div className="flex items-center justify-center gap-1 font-bold text-neutral-300 text-sm mt-0.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{task.durationMinutes || 1} د</span>
            </div>
          </div>
        </div>

        {/* Target Account Card (Requirement #6 & #7) */}
        {task.targetUsername && (task.platform === 'TikTok' || task.platform === 'Instagram' || task.targetUsername) && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-neutral-300 block">الحساب المستهدف للمتابعة:</span>
            <AccountCard
              platform={task.platform}
              username={task.targetUsername}
              displayName={task.targetDisplayName}
              avatarUrl={task.targetAvatarUrl}
              isVerified={task.isAccountVerified}
              showFollowButton={true}
            />
          </div>
        )}

        {/* Task Description & Instructions (Requirement #9) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-neutral-300">تعليمات المهمة والهدف:</h3>
          <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 text-xs text-neutral-300 leading-relaxed space-y-2">
            <p>{task.description}</p>
            {task.instructions && (
              <p className="text-amber-200/90 font-medium pt-1 border-t border-neutral-800">
                📌 {task.instructions}
              </p>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {status === 'APPROVED' && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>لقد أنجزت هذه المهمة بالفعل وتم اعتماد المكافأة وإيداعها في رصيدك!</span>
          </div>
        )}

        {status === 'PENDING' && (
          <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>
              إنجازك قيد المراجعة حالياً (PENDING). ستتم مراجعته واعتماد النقاط تلقائياً بواسطة الإدارة.
            </span>
          </div>
        )}

        {status === 'REJECTED' && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>تم رفض المحاولة السابقة. يمكنك إعادة التقديم مع إرفاق توضيح أو إثبات إضافي.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Mandatory Buttons (Requirement #9: [فتح المهمة] & [أنجزت المهمة]) */}
        {!isAlreadySubmitted && (
          <form onSubmit={handleSubmitCompletion} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300">
                ملاحظات أو إثبات إنجاز (اختياري)
              </label>
              <input
                type="text"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="اسم حسابك أو كلمة تأكيد أو ملاحظة للمراجع..."
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-900/90 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Button 1: Open Account to Follow */}
              <button
                type="button"
                onClick={handleOpenTaskUrl}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-neutral-800/90 hover:bg-neutral-800 text-neutral-200 font-bold text-xs transition-colors cursor-pointer border border-neutral-700"
              >
                <ExternalLink className="w-4 h-4 text-amber-400" />
                <span>فتح الحساب والمتابعة</span>
              </button>

              {/* Button 2: Submit Task Completion */}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black text-xs shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'جار الإرسال للاعتماد...' : 'إكمال المهمة (+1 نقطة)'}</span>
              </button>
            </div>
          </form>
        )}

        {isAlreadySubmitted && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
