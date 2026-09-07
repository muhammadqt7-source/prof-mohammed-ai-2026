/**
 * Professor Mohammad Mahdi AI Platform Types
 * بروفيسور محمد مهدي AI
 */

export type TaskType =
  | 'FOLLOWERS'
  | 'VISIT_URL'
  | 'WATCH_CONTENT'
  | 'READ_ARTICLE'
  | 'COMPLETE_QUIZ'
  | 'SURVEY'
  | 'OPEN_RESOURCE'
  | 'LEARNING_TASK';

export type CampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export type CompletionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PointTransactionType =
  | 'FIRST_CAMPAIGN_BONUS'
  | 'CAMPAIGN_COST'
  | 'TASK_REWARD'
  | 'CAMPAIGN_REFUND'
  | 'ADMIN_ADJUSTMENT'
  | 'DAILY_BONUS';

export type XPLevel =
  | 'BEGINNER'
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND';

export interface AnonymousUser {
  id: string;
  username: string;
  points: number;
  xp: number;
  level: XPLevel;
  currentStreak: number;
  highestStreak: number;
  lastClaimDate: string | null;
  completedTasksCount: number;
  campaignsCreatedCount: number;
  firstCampaignBonusGranted: boolean;
  createdAt: string;
  updatedAt: string;
  role: 'user' | 'admin';
}

export interface Campaign {
  id: string;
  anonymousUserId: string;
  creatorName?: string;
  title: string;
  description: string;
  platform: string;
  targetPlatform?: string;
  taskType: TaskType;
  targetUsername?: string;
  targetDisplayName?: string;
  targetAvatarUrl?: string;
  isAccountVerified?: boolean;
  targetAccountVerified?: boolean;
  targetUrl: string;
  targetProfileUrl?: string;
  targetCompletions: number;
  currentProgress: number;
  rewardPerCompletion: number;
  totalBudget: number;
  spentBudget: number;
  remainingBudget: number;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  status: CampaignStatus;
}

export interface Task {
  id: string;
  campaignId?: string;
  title: string;
  description: string;
  taskType: TaskType;
  platform: string;
  targetPlatform?: string;
  targetUrl: string;
  targetProfileUrl?: string;
  targetUsername?: string;
  targetDisplayName?: string;
  targetAvatarUrl?: string;
  isAccountVerified?: boolean;
  targetAccountVerified?: boolean;
  reward: number;
  xpReward: number;
  estimatedMinutes: number;
  instructions: string[];
  status: 'ACTIVE' | 'INACTIVE';
  totalCompletionsRequired?: number;
  currentCompletions?: number;
  createdAt: string;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  campaignId?: string;
  anonymousUserId: string;
  status: CompletionStatus;
  reward: number;
  xpReward: number;
  proofNote?: string;
  submittedAt: string;
  verifiedAt?: string;
  verificationNote?: string;
  taskTitle?: string;
  taskType?: TaskType;
}

export interface PointTransaction {
  id: string;
  anonymousUserId: string;
  type: PointTransactionType;
  amount: number; // positive for credit, negative for debit
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface XPTransaction {
  id: string;
  anonymousUserId: string;
  amount: number;
  xpBefore: number;
  xpAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface DailyStreakInfo {
  currentStreak: number;
  highestStreak: number;
  lastClaimDate: string | null;
  canClaimToday: boolean;
  nextMilestone: {
    days: number;
    xpBonus: number;
    pointsBonus: number;
  } | null;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface LevelThreshold {
  level: XPLevel;
  minXP: number;
  labelAr: string;
  labelEn: string;
  badgeColor: string;
  perks: string[];
}

export const LEVEL_THRESHOLDS: LevelThreshold[] = [
  {
    level: 'BEGINNER',
    minXP: 0,
    labelAr: 'مبتدئ',
    labelEn: 'Beginner',
    badgeColor: '#94a3b8',
    perks: ['بدء تنفيذ المهام', 'إنشاء الحملات الأساسية'],
  },
  {
    level: 'BRONZE',
    minXP: 500,
    labelAr: 'برونزي',
    labelEn: 'Bronze',
    badgeColor: '#cd7f32',
    perks: ['مكافأة يومية إضافية +5%', 'أولوية الظهور في المهام'],
  },
  {
    level: 'SILVER',
    minXP: 1500,
    labelAr: 'فضي',
    labelEn: 'Silver',
    badgeColor: '#e2e8f0',
    perks: ['خصم 5% على تكلفة الحملات', 'شارات حصرية'],
  },
  {
    level: 'GOLD',
    minXP: 3000,
    labelAr: 'ذهبي',
    labelEn: 'Gold',
    badgeColor: '#f59e0b',
    perks: ['مكافأة يومية +15%', 'إمكانية ترويج المهام في الصدارة'],
  },
  {
    level: 'PLATINUM',
    minXP: 7000,
    labelAr: 'بلاتيني',
    labelEn: 'Platinum',
    badgeColor: '#38bdf8',
    perks: ['مكافأة مضاعفة للـ Daily Streak', 'اعتماد فوري لبعض المهام'],
  },
  {
    level: 'DIAMOND',
    minXP: 15000,
    labelAr: 'الماسي',
    labelEn: 'Diamond',
    badgeColor: '#c084fc',
    perks: ['أعلى رتبة شرفية بالمنصة', 'مزايا حصرية غير محدودة'],
  },
];
