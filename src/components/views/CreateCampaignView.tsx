import React, { useState, useEffect, useRef } from 'react';
import {
  Coins,
  AlertCircle,
  CheckCircle,
  Layers,
  Sparkles,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Instagram,
  Users,
  Eye,
  AtSign,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { AnonymousUser, Campaign } from '../../types.js';
import { api } from '../../services/api.js';
import { AccountCard } from '../AccountCard.js';
import { parseProfileUrl } from '../../utils/urlParser.js';

interface CreateCampaignViewProps {
  user: AnonymousUser | null;
  onCampaignCreated: (campaign: Campaign, newBalance: number) => void;
  onCancel: () => void;
}

type PlatformChoice = 'Instagram' | 'TikTok';

export const CreateCampaignView: React.FC<CreateCampaignViewProps> = ({
  user,
  onCampaignCreated,
  onCancel,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformChoice>('TikTok');
  const [targetProfileUrl, setTargetProfileUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(1440);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    checked: boolean;
    isVerified: boolean;
    displayName?: string;
    avatarUrl?: string;
    cleanUsername: string;
    canonicalUrl: string;
    reason?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const verifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Business Rule: 50 Points = 1 Campaign (50 followers at 1 point reward each)
  const FIXED_CAMPAIGN_COST = 50;
  const FIXED_TARGET_COMPLETIONS = 50;
  const FIXED_REWARD_PER_COMPLETION = 1;

  const currentBalance = user?.points || 0;
  const balanceAfter = currentBalance - FIXED_CAMPAIGN_COST;
  const isInsufficientBalance = currentBalance < FIXED_CAMPAIGN_COST;

  // Real-time URL parse
  const parsedInfo = parseProfileUrl(targetProfileUrl, selectedPlatform);

  const handleSelectPlatform = (platform: PlatformChoice) => {
    setSelectedPlatform(platform);
    setErrorMessage(null);
    setVerificationResult(null);
  };

  // Perform official API verification
  const handleVerifyAccount = async (profileUrlToVerify?: string) => {
    const urlToUse = profileUrlToVerify || targetProfileUrl;
    const info = parseProfileUrl(urlToUse, selectedPlatform);

    if (!info.isValid || !info.cleanUsername) {
      setErrorMessage(info.error || 'يرجى إدخال رابط حساب صالح');
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);

      const res = await api.verifyAccount({
        profileUrl: info.canonicalUrl,
        platform: selectedPlatform,
      });

      setVerificationResult({
        checked: true,
        isVerified: res.isVerified,
        displayName: res.displayName || undefined,
        avatarUrl: res.avatarUrl || undefined,
        cleanUsername: res.cleanUsername || info.cleanUsername,
        canonicalUrl: res.canonicalUrl || info.canonicalUrl,
        reason: res.reason || undefined,
      });
    } catch (err: any) {
      // If error occurs, strictly treat as unverified without fake data
      setVerificationResult({
        checked: true,
        isVerified: false,
        displayName: undefined,
        avatarUrl: undefined,
        cleanUsername: info.cleanUsername,
        canonicalUrl: info.canonicalUrl,
        reason: err.message || 'تعذر التحقق من الحساب عبر API الرسمي.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify after typing stops (debounce 700ms)
  useEffect(() => {
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
    }

    if (parsedInfo.isValid && parsedInfo.cleanUsername) {
      if (!verificationResult || verificationResult.cleanUsername !== parsedInfo.cleanUsername) {
        verifyTimeoutRef.current = setTimeout(() => {
          handleVerifyAccount(parsedInfo.canonicalUrl);
        }, 700);
      }
    } else {
      setVerificationResult(null);
    }

    return () => {
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
      }
    };
  }, [targetProfileUrl, selectedPlatform]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!parsedInfo.isValid || !parsedInfo.cleanUsername) {
      setErrorMessage(parsedInfo.error || 'يرجى إدخال رابط الحساب المستهدف بشكل صحيح');
      return;
    }

    if (isInsufficientBalance) {
      setErrorMessage('تحتاج إلى 50 نقطة لإنشاء حملة.');
      return;
    }

    try {
      setLoading(true);

      const isVerified = Boolean(verificationResult?.isVerified);
      const cleanUsername = parsedInfo.cleanUsername;
      const canonicalUrl = parsedInfo.canonicalUrl;

      const res = await api.createCampaign({
        title: `متابعين ${selectedPlatform}: @${cleanUsername}`,
        description: `قم بمتابعة الحساب @${cleanUsername} على ${selectedPlatform} للحصول على +1 نقطة معتمدة فورياً.`,
        platform: selectedPlatform,
        targetPlatform: selectedPlatform,
        taskType: 'FOLLOWERS',
        targetUsername: cleanUsername,
        targetProfileUrl: canonicalUrl,
        targetUrl: canonicalUrl,
        isAccountVerified: isVerified,
        targetAccountVerified: isVerified,
        targetDisplayName: isVerified ? verificationResult?.displayName : undefined,
        targetAvatarUrl: isVerified ? verificationResult?.avatarUrl : undefined,
        targetCompletions: FIXED_TARGET_COMPLETIONS,
        rewardPerCompletion: FIXED_REWARD_PER_COMPLETION,
        durationMinutes,
      });

      setSuccessMessage(res.message);
      setTimeout(() => {
        onCampaignCreated(res.campaign, res.userBalance);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'تحتاج إلى 50 نقطة لإنشاء حملة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">إنشاء حملة متابعين جديدة</h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1">
            اختر منصتك وضع اسم المستخدم. تكلفة الحملة ثابتة: 50 نقطة تمنحك 50 متابع حقيقي (+1 نقطة لكل متابع).
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-neutral-300">رصيدك:</span>
          <span className="text-sm font-black text-amber-300">{currentBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* Platform Cards Selection: Strictly Instagram & TikTok (Followers Only) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-200">
          اختر منصة الحملة (متابعين Followers فقط):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* TikTok Follower Campaign Card */}
          <div
            onClick={() => handleSelectPlatform('TikTok')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              selectedPlatform === 'TikTok'
                ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-500/10 border-amber-400 shadow-[0_0_25px_rgba(234,179,8,0.25)] ring-1 ring-amber-400/50'
                : 'glass-panel border-neutral-800 hover:border-neutral-700 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-black border border-neutral-700 flex items-center justify-center text-white font-black text-xs shadow-md">
                  <span className="text-amber-400 text-base font-bold">♪</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">TikTok Follower Campaign</h3>
                  <span className="text-[11px] text-amber-300/90 font-medium">حملة متابعين تيك توك</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                50 نقطة
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              زيادة 50 متابع حقيقي لحسابك على TikTok. يدخل المستخدمون إلى حسابك يدوياً ويقومون بالمتابعة للحصول على +1 نقطة.
            </p>

            <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>الهدف: 50 متابع</span>
              </span>
              <span className="text-emerald-400 font-bold">+1 نقطة / متابع</span>
            </div>
          </div>

          {/* Instagram Follower Campaign Card */}
          <div
            onClick={() => handleSelectPlatform('Instagram')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              selectedPlatform === 'Instagram'
                ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-pink-500/10 border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.25)] ring-1 ring-pink-500/50'
                : 'glass-panel border-neutral-800 hover:border-neutral-700 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Instagram Follower Campaign</h3>
                  <span className="text-[11px] text-rose-300/90 font-medium">حملة متابعين انستغرام</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                50 نقطة
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              زيادة 50 متابع حقيقي لحسابك على Instagram. يدخل المستخدمون إلى حسابك يدوياً ويقومون بالمتابعة للحصول على +1 نقطة.
            </p>

            <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>الهدف: 50 متابع</span>
              </span>
              <span className="text-emerald-400 font-bold">+1 نقطة / متابع</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Guarantee Banner (No password, No cookies, 100% safe manual follow) */}
      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold block">أمان وخصوصية تامة بدون طلب أي كلمات مرور:</span>
          <p className="text-[11px] text-emerald-300/90 leading-relaxed">
            لا نطلب كلمة مرور حسابك، ولا Cookies، ولا Session Tokens.
            يتم توجيه الأعضاء إلى صفحة حسابك العامة للمتابعة اليدوية الآمنة 100%.
          </p>
        </div>
      </div>

      {/* Real-time Calculation Panel: Fixed 50 Points */}
      <div className="rounded-2xl glass-panel p-5 gold-metallic-border space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>المعادلة الاقتصادية: 50 نقطة = حملة واحدة (50 متابع)</span>
          </span>
          <span className="text-xs text-amber-400/80 font-mono">
            50 متابع × 1 نقطة لكل إنجاز = 50 نقطة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 text-center">
            <span className="text-xs text-neutral-400">رصيدك الحالي</span>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {currentBalance.toLocaleString()}{' '}
              <span className="text-xs font-normal text-neutral-400">نقطة</span>
            </div>
          </div>

          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-400/30 text-center">
            <span className="text-xs text-amber-300 font-semibold">تكلفة إنشاء الحملة</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              50 <span className="text-xs font-normal text-amber-300/80">نقطة</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border text-center ${
              isInsufficientBalance
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <span className="text-xs">
              {isInsufficientBalance ? 'النقاط المطلوبة' : 'رصيدك بعد الخصم'}
            </span>
            <div className="text-xl font-extrabold mt-0.5">
              {isInsufficientBalance
                ? `${50 - currentBalance} نقطة مطلوبة`
                : `${balanceAfter.toLocaleString()} نقطة`}
            </div>
          </div>
        </div>

        {/* Warning if Insufficient Balance */}
        {isInsufficientBalance && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              تحتاج إلى 50 نقطة لإنشاء حملة. رصيدك الحالي {currentBalance} نقطة. أنجز المهام لكسب +1 نقطة عن كل مهمة!
            </span>
          </div>
        )}
      </div>

      {/* Campaign Form with Username & Live Account Card Preview */}
      <form onSubmit={handleSubmit} className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-5">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Primary Field: Target Profile URL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>رابط الحساب المستهدف</span>
              <span className="text-amber-400">*</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              {selectedPlatform === 'Instagram'
                ? 'https://www.instagram.com/username/'
                : 'https://www.tiktok.com/@username'}
            </span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-neutral-500">
              <LinkIcon className="w-4 h-4 text-amber-400" />
            </div>
            <input
              type="text"
              required
              value={targetProfileUrl}
              onChange={(e) => {
                setTargetProfileUrl(e.target.value);
                setErrorMessage(null);
              }}
              placeholder={
                selectedPlatform === 'Instagram'
                  ? 'https://www.instagram.com/username/'
                  : 'https://www.tiktok.com/@username'
              }
              className="w-full pr-10 pl-28 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none font-mono dir-ltr text-left"
            />
            {/* Quick manual verify button */}
            <div className="absolute inset-y-0 left-1.5 flex items-center">
              <button
                type="button"
                onClick={() => handleVerifyAccount()}
                disabled={isVerifying || !targetProfileUrl.trim()}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-all flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span>تحقق...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>فحص الحساب</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-neutral-400 gap-1">
            <p>
              يقبل رابط الحساب الشخصي المباشر فقط (مثل: <code className="text-amber-300/90 font-mono text-[10px]">{selectedPlatform === 'Instagram' ? 'https://www.instagram.com/username/' : 'https://www.tiktok.com/@username'}</code>)
            </p>
            {parsedInfo.isValid && parsedInfo.cleanUsername && (
              <span className="text-amber-300 font-mono text-xs dir-ltr text-right shrink-0">
                المستخرج: @{parsedInfo.cleanUsername}
              </span>
            )}
          </div>

          {targetProfileUrl.trim().length > 5 && !parsedInfo.isValid && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{parsedInfo.error}</span>
            </div>
          )}
        </div>

        {/* Live Account Preview Card with Verification Status */}
        {parsedInfo.isValid && parsedInfo.cleanUsername && (
          <div className="space-y-3 p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>معاينة بطاقة الحساب في المهمة (AccountCard):</span>
              </span>
              <span className="text-[10px] text-neutral-400">تظهر في قائمة المهام</span>
            </div>

            {/* Verification Status Pill */}
            <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-neutral-900/70 border border-neutral-800">
              <div className="flex items-center gap-2">
                {isVerifying ? (
                  <span className="text-amber-300 flex items-center gap-1.5 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ التحقق عبر API المنصة الرسمي...</span>
                  </span>
                ) : verificationResult?.isVerified ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>تم التحقق من الحساب بنجاح عبر API الرسمي (بيانات حقيقية)</span>
                  </span>
                ) : (
                  <span className="text-amber-400/90 flex items-center gap-1 text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>ACCOUNT_DATA_UNAVAILABLE (البيانات الرسمية غير متاحة)</span>
                  </span>
                )}
              </div>

              <span className="text-[10px] text-neutral-400 font-mono dir-ltr">
                {selectedPlatform}
              </span>
            </div>

            {/* AccountCard Component with real follow button */}
            <AccountCard
              platform={selectedPlatform}
              username={parsedInfo.cleanUsername}
              displayName={verificationResult?.isVerified ? verificationResult.displayName : undefined}
              avatarUrl={verificationResult?.isVerified ? verificationResult.avatarUrl : undefined}
              isVerified={Boolean(verificationResult?.isVerified)}
              targetUrl={parsedInfo.canonicalUrl}
              showFollowButton={true}
            />

            <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1">
              <span className="truncate max-w-[280px] sm:max-w-md font-mono text-[10px] text-amber-300/80 dir-ltr text-right">
                {parsedInfo.canonicalUrl}
              </span>
              <span className="text-[10px] text-neutral-400 shrink-0">رابط الحساب المعتمد للحملة</span>
            </div>
          </div>
        )}

        {/* Campaign Parameters Overview (Fixed 50 completions & 1 point reward) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
          <div>
            <span className="text-[10px] text-neutral-400 block">المتابعين المطلوبين</span>
            <span className="text-sm font-black text-amber-300">50 متابع</span>
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 block">المكافأة لكل متابع</span>
            <span className="text-sm font-black text-emerald-400">+1 نقطة</span>
          </div>
          <div>
            <span className="text-[10px] text-neutral-400 block">صلاحية الحملة</span>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-0.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value={1440}>24 ساعة (يوم كامل)</option>
              <option value={2880}>48 ساعة (يومان)</option>
              <option value={10080}>7 أيام (أسبوع)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="submit"
            disabled={loading || isInsufficientBalance || !parsedInfo.isValid}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isInsufficientBalance || !parsedInfo.isValid
                ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 font-black shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:scale-[1.02] active:scale-95'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>
              {loading
                ? 'جار إنشاء الحملة وخصم 50 نقطة...'
                : isInsufficientBalance
                ? 'تحتاج إلى 50 نقطة لإنشاء حملة'
                : 'إنشاء حملة متابعين وخصم 50 نقطة'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
