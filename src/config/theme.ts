/**
 * ============================================================================
 * Central Theme & Appearance Configuration
 * نظام إعدادات المظهر والخلفية الموحد — بروفيسور محمد مهدي AI
 * ============================================================================
 * 
 * يمكنك تغيير الخلفية والمظهر بالكامل من هذا الملف فقط بدون المساس
 * بالمنطق الداخلي، قواعد البيانات، أو الـ Backend.
 */

export interface ThemeConfig {
  // نوع الخلفية: 'image' | 'gradient' | 'cyber_grid' | 'video'
  backgroundType: 'image' | 'gradient' | 'cyber_grid' | 'video';

  // مسار صورة الخلفية (يتم سحبها من مجلد public/background/)
  backgroundImage: string;

  // مسار فيديو الخلفية (في حال تفعيل نوع الفيديو)
  backgroundVideo?: string;

  // شفافية طبقة التعتيم (من 0 إلى 1)
  overlayOpacity: number;

  // لون طبقة التعتيم الخلفية
  overlayColor: string;

  // درجة الضبابية (Blur)
  blurIntensity: 'none' | 'sm' | 'md' | 'lg' | 'xl';

  // تفعيل جزيئات الذكاء الاصطناعي (AI Particles)
  enableParticles: boolean;

  // توهج ذهبي فخم (Golden Glow)
  enableGoldGlow: boolean;

  // شبكة الهولوغرام السيبرانية
  enableHoloGrid: boolean;

  // نمط الألوان الرئيسي
  palette: {
    primaryGold: string;
    secondaryGold: string;
    deepNavy: string;
    deepBlack: string;
    cardBg: string;
    cardBorder: string;
    glowAccent: string;
  };
}

export const defaultThemeConfig: ThemeConfig = {
  backgroundType: 'image',
  // يمكنك تغيير الصورة بسهولة هنا أو استبدال ملف public/background/background.jpg
  backgroundImage: '/background/background.jpg',
  backgroundVideo: '',
  overlayOpacity: 0.88,
  overlayColor: 'rgba(3, 7, 18, 0.85)',
  blurIntensity: 'sm',
  enableParticles: true,
  enableGoldGlow: true,
  enableHoloGrid: true,
  palette: {
    primaryGold: '#eab308',
    secondaryGold: '#d97706',
    deepNavy: '#0a0f24',
    deepBlack: '#030712',
    cardBg: 'rgba(10, 15, 36, 0.65)',
    cardBorder: 'rgba(234, 179, 8, 0.2)',
    glowAccent: 'rgba(234, 179, 8, 0.35)',
  },
};

export const DEFAULT_THEME_CONFIG = defaultThemeConfig;

// أنماط خلفيات جاهزة يمكن التبديل بينها
export const PRESET_BACKGROUNDS = [
  {
    id: 'ai_lab_default',
    name: 'مختبر البروفيسور الذكي (افتراضي)',
    path: '/background/background.jpg',
    type: 'image' as const,
  },
  {
    id: 'cyber_grid',
    name: 'مصفوفة نيون سيبرانية',
    path: '',
    type: 'cyber_grid' as const,
  },
  {
    id: 'deep_space',
    name: 'تدرج كوني عميق',
    path: '',
    type: 'gradient' as const,
  },
];
