import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  AlertTriangle,
  RefreshCw,
  Sliders,
  User,
  Layers,
  History,
  Check,
  ExternalLink,
} from 'lucide-react';
import { AdminAuditLog, TaskCompletion } from '../../types.js';
import { api } from '../../services/api.js';

interface AdminDashboardViewProps {
  onDataChanged: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onDataChanged }) => {
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [overview, setOverview] = useState<{
    totalUsers: number;
    activeCampaignsCount: number;
    totalCampaignsCount: number;
    pendingCompletionsCount: number;
    totalTasksCount: number;
    totalTransactionsCount: number;
  } | null>(null);

  const [pendingCompletions, setPendingCompletions] = useState<TaskCompletion[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Adjustment state
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('مكافأة تميز إدارية');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovRes, compRes, logsRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminCompletions('PENDING'),
        api.getAdminAuditLogs(),
      ]);

      setOverview(ovRes);
      setPendingCompletions(compRes.completions);
      setAuditLogs(logsRes.logs);
    } catch (err: any) {
      setFeedback(err.message || 'فشل تحميل بيانات الإدارة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      setActionInProgress(id);
      const res = await api.approveCompletion(id, 'تم التحقق والاعتماد بنجاح');
      setFeedback(`تم اعتماد الإنجاز وإيداع المكافأة للعامل فورياً!`);
      await loadData();
      onDataChanged();
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('يرجى كتابة سبب الرفض:', 'لم يتم استيفاء شروط المهمة بشكل صحيح');
    if (!reason) return;

    try {
      setActionInProgress(id);
      await api.rejectCompletion(id, reason);
      setFeedback('تم رفض الإنجاز بنجاح');
      await loadData();
      onDataChanged();
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId.trim()) {
      setFeedback('يرجى إدخال معرف المستخدم');
      return;
    }

    try {
      setActionInProgress('adjust');
      const res = await api.adjustUserPoints(adjustUserId.trim(), adjustAmount, adjustReason);
      setFeedback(`تم تعديل نقاط المستخدم بنجاح! رصيده الجديد: ${res.user.points} نقطة`);
      setAdjustUserId('');
      await loadData();
      onDataChanged();
    } catch (err: any) {
      setFeedback(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>لوحة الإدارة والتحقق (Admin Control Center)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
            نظام المراجعة والاعتماد الفوري
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            مراجعة إنجازات المستخدمين (PENDING)، اعتماد صرف النقاط، والرقابة على الحملات والعمليات.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-amber-300 text-xs font-semibold cursor-pointer transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-neutral-400 block">المستخدمين</span>
          <div className="text-2xl font-black text-white mt-1">{overview?.totalUsers || 0}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-yellow-400 block">بانتظار المراجعة</span>
          <div className="text-2xl font-black text-yellow-300 mt-1">
            {overview?.pendingCompletionsCount || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-amber-400 block">الحملات النشطة</span>
          <div className="text-2xl font-black text-amber-300 mt-1">
            {overview?.activeCampaignsCount || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-neutral-400 block">إجمالي الحملات</span>
          <div className="text-2xl font-black text-neutral-200 mt-1">
            {overview?.totalCampaignsCount || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-blue-400 block">المهام الكلية</span>
          <div className="text-2xl font-black text-blue-300 mt-1">
            {overview?.totalTasksCount || 0}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl gold-metallic-border">
          <span className="text-[10px] text-emerald-400 block">حركات النقاط</span>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            {overview?.totalTransactionsCount || 0}
          </div>
        </div>
      </div>

      {/* 1. Pending Completions Review Queue (Requirement #10 & #20) */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h2 className="text-base font-bold text-white">
              طابور طلبات الإنجاز المعلقة (Pending Review Queue)
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-bold">
              {pendingCompletions.length} طلب
            </span>
          </div>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            الاعتماد يحول النقاط تلقائياً للعامل ويحدث ميزانية الحملة
          </span>
        </div>

        {pendingCompletions.length === 0 ? (
          <div className="py-10 text-center text-neutral-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs">رائع! تم البت في كافة طلبات الإنجاز، لا توجد طلبات معلقة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingCompletions.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">طلب إنجاز #{c.id.slice(-6)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">
                      المهمة: {c.taskId}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-3">
                    <span>العامل: <span className="font-mono text-neutral-300">{c.anonymousUserId}</span></span>
                    <span>•</span>
                    <span>التاريخ: {new Date(c.submittedAt).toLocaleTimeString('ar-EG')}</span>
                  </div>

                  {c.proofNote && (
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800/80 text-xs text-amber-200">
                      📝 ملاحظة الإثبات: "{c.proofNote}"
                    </div>
                  )}
                </div>

                {/* Actions: Approve / Reject */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(c.id)}
                    disabled={actionInProgress === c.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actionInProgress === c.id ? 'جار الاعتماد...' : 'قبول واعتماد المكافأة'}</span>
                  </button>

                  <button
                    onClick={() => handleReject(c.id)}
                    disabled={actionInProgress === c.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Manual Points Adjustment Tool */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <Coins className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">تعديل رصيد النقاط يدوياً (Manual Points Adjust)</h2>
        </div>

        <form onSubmit={handleAdjustPoints} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-neutral-300">معرف المستخدم (Anonymous User ID)</label>
            <input
              type="text"
              required
              value={adjustUserId}
              onChange={(e) => setAdjustUserId(e.target.value)}
              placeholder="user_..."
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-300">المبلغ (+ أو -)</label>
            <input
              type="number"
              required
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white focus:border-amber-400 focus:outline-none font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={actionInProgress === 'adjust'}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black text-xs shadow-[0_0_15px_rgba(234,179,8,0.3)] hover:scale-[1.02] transition-all cursor-pointer"
          >
            {actionInProgress === 'adjust' ? 'جار التعديل...' : 'تنفيذ التعديل'}
          </button>
        </form>
      </div>

      {/* 3. System Audit Logs */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <History className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-bold text-white">سجل العمليات الإدارية (Audit Logs)</h2>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-neutral-400 py-4 text-center">لا توجد سجلات إدارية بعد.</p>
        ) : (
          <div className="divide-y divide-neutral-800 max-h-80 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-purple-300 font-bold">{log.action}</span>
                  <span className="text-neutral-300">{log.details}</span>
                  {log.targetId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                      {log.targetId}
                    </span>
                  )}
                </div>
                <span className="text-neutral-500 text-[10px] whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('ar-EG')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
