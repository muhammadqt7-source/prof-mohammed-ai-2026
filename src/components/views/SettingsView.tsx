import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Image,
  Sliders,
  Sparkles,
  User,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Shield,
  Layers,
} from 'lucide-react';
import { ThemeConfig } from '../../config/theme.js';
import { getAnonymousUserId, resetAnonymousUserId, setCustomAnonymousUserId } from '../../services/api.js';

interface SettingsViewProps {
  themeConfig: ThemeConfig;
  onUpdateTheme: (newConfig: Partial<ThemeConfig>) => void;
  onResetTheme: () => void;
  onIdentityChanged: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  themeConfig,
  onUpdateTheme,
  onResetTheme,
  onIdentityChanged,
}) => {
  const [currentId, setCurrentId] = useState(getAnonymousUserId());
  const [customInputId, setCustomInputId] = useState('');
  const [copied, setCopied] = useState(false);
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);

  const backgroundPresets = [
    {
      name: 'مختبر الذكاء الاصطناعي المستقبلي (الافتراضي)',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    },
    {
      name: 'شبكة سيبرانية مظلمة (Cyber Matrix)',
      url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1920&q=80',
    },
    {
      name: 'أمواج ذهبية ونواة معالجة (Golden Core)',
      url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1920&q=80',
    },
    {
      name: 'فضاء عميق وسديم رقمي (Deep Space)',
      url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    },
  ];

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetIdentity = () => {
    if (confirm('هل تريد إنشاء هوية مستخدم جديدة وتفريغ الجلسة الحالية؟')) {
      const newId = resetAnonymousUserId();
      setCurrentId(newId);
      setIdentityMessage('تم توليد هوية جديدة بنجاح!');
      onIdentityChanged();
    }
  };

  const handleSwitchIdentity = () => {
    if (!customInputId.trim()) return;
    setCustomAnonymousUserId(customInputId.trim());
    setCurrentId(customInputId.trim());
    setCustomInputId('');
    setIdentityMessage('تم التبديل إلى الهوية المحددة بنجاح!');
    onIdentityChanged();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold gold-gradient-text">
          الإعدادات وتخصيص المظهر (Theme)
        </h1>
        <p className="text-xs sm:text-sm text-neutral-300 mt-1">
          تحكم كامل في طبقات الخلفية والتعتيم دون التأثير على عناصر الواجهة، مع إدارة هوية المستخدم الذكية.
        </p>
      </div>

      {identityMessage && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-between">
          <span>{identityMessage}</span>
          <button onClick={() => setIdentityMessage(null)} className="text-neutral-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 1. Requirement #25 & #26: Theme & Background Layer Control */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">طبقة الخلفية والشفافية (Background Layers)</h2>
          </div>
          <button
            onClick={onResetTheme}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            استعادة الوضع الافتراضي
          </button>
        </div>

        {/* Background Type */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-200">نوع الخلفية (Background Type)</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'image', label: 'صورة مختبر AI' },
              { id: 'gradient', label: 'تدرج كوني أزرق' },
              { id: 'solid', label: 'أسود عميق (#030712)' },
            ].map((bt) => (
              <button
                key={bt.id}
                onClick={() => onUpdateTheme({ backgroundType: bt.id as any })}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  themeConfig.backgroundType === bt.id
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                    : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800 hover:text-white'
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background Presets if image */}
        {themeConfig.backgroundType === 'image' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-200">نماذج صور الخلفية المقترحة</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {backgroundPresets.map((p) => (
                <button
                  key={p.url}
                  onClick={() => onUpdateTheme({ backgroundImage: p.url })}
                  className={`p-2.5 rounded-xl text-right text-xs transition-all border cursor-pointer ${
                    themeConfig.backgroundImage === p.url
                      ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-bold'
                      : 'bg-neutral-900/50 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg bg-cover bg-center shrink-0 border border-neutral-700"
                      style={{ backgroundImage: `url(${p.url})` }}
                    />
                    <span className="line-clamp-1">{p.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overlay Opacity Slider */}
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>درجة عتامة الطبقة الشفافة (Overlay Opacity)</span>
            </span>
            <span className="font-mono text-amber-300 font-bold">
              {Math.round(themeConfig.overlayOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.95"
            step="0.05"
            value={themeConfig.overlayOpacity}
            onChange={(e) => onUpdateTheme({ overlayOpacity: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-500">
            <span>شفافية عالية (تظهر الخلفية بوضوح)</span>
            <span>تعتيم كامل (تركيز على المحتوى)</span>
          </div>
        </div>

        {/* Blur Intensity */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-200">
            تأثير ضبابية الزجاج (Backdrop Blur)
          </label>
          <div className="grid grid-cols-5 gap-2 text-xs">
            {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((b) => (
              <button
                key={b}
                onClick={() => onUpdateTheme({ blurIntensity: b })}
                className={`py-1.5 rounded-lg font-mono uppercase transition-all cursor-pointer ${
                  themeConfig.blurIntensity === b
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 font-bold'
                    : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer">
            <span className="text-xs font-bold text-neutral-200">شبكة سيبرانية هولوغرافية</span>
            <input
              type="checkbox"
              checked={themeConfig.enableHoloGrid}
              onChange={(e) => onUpdateTheme({ enableHoloGrid: e.target.checked })}
              className="accent-amber-400 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer">
            <span className="text-xs font-bold text-neutral-200">إضاءات ذهبية محيطية (Glow)</span>
            <input
              type="checkbox"
              checked={themeConfig.enableGoldGlow}
              onChange={(e) => onUpdateTheme({ enableGoldGlow: e.target.checked })}
              className="accent-amber-400 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 2. Anonymous Identity Manager (Requirement #1) */}
      <div className="rounded-2xl glass-panel p-6 gold-metallic-border space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
          <User className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">إدارة الهوية المجهولة (Anonymous Identity)</h2>
        </div>

        <p className="text-xs text-neutral-300">
          تطبيق بروفيسور محمد مهدي AI يعمل دون تسجيل أو كلمة مرور. يتم حفظ رصيدك وسلسلتك بواسطة هذا المعرف
          المحفوظ في متصفحك والمتزامن مع السيرفر:
        </p>

        <div className="flex items-center gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
          <span className="text-xs font-mono text-amber-300 flex-1 break-all select-all">
            {currentId}
          </span>
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ المعرف'}</span>
          </button>
        </div>

        {/* Identity Tools for Multi-User Testing */}
        <div className="pt-2 border-t border-neutral-800 space-y-3">
          <span className="text-xs font-bold text-neutral-300 block">
            تبديل الهوية (مفيد لتجربة تعدد المستخدمين والتفاعل بين الحسابات):
          </span>

          <div className="flex gap-2">
            <input
              type="text"
              value={customInputId}
              onChange={(e) => setCustomInputId(e.target.value)}
              placeholder="ألصق معرف مستخدم آخر هنا..."
              className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={handleSwitchIdentity}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
            >
              تبديل
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleResetIdentity}
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>توليد حساب مجهول جديد كلياً</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
