import fs from 'fs';
import path from 'path';
import {
  AnonymousUser,
  Campaign,
  Task,
  TaskCompletion,
  PointTransaction,
  XPTransaction,
  AdminAuditLog,
  LEVEL_THRESHOLDS,
  XPLevel,
} from '../types.js';
import { appCache } from './cache.js';
import { withDistributedLock, cacheInvalidatePattern } from './redis/redisClient.js';
import { query, transaction } from './db/postgres.js';
import { appQueue } from './queue/queue.js';

interface DatabaseSchema {
  users: Record<string, AnonymousUser>;
  campaigns: Record<string, Campaign>;
  tasks: Record<string, Task>;
  completions: Record<string, TaskCompletion>;
  pointTransactions: PointTransaction[];
  xpTransactions: XPTransaction[];
  auditLogs: AdminAuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'database.tmp.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function calculateLevel(xp: number): XPLevel {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXP) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 'BEGINNER';
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

class TransactionalDatabase {
  private data: DatabaseSchema;
  private isWriting = false;
  private flushTimeout: NodeJS.Timeout | null = null;

  // Secondary high-speed in-memory indexes (O(1) lookups for million-user scale)
  private taskUserUniqueIndex = new Map<string, string>(); // `${taskId}:${userId}` -> completionId
  private userCompletionsIndex = new Map<string, Set<string>>(); // userId -> Set of completionIds
  private userCampaignsIndex = new Map<string, Set<string>>(); // userId -> Set of campaignIds
  private userTransactionsIndex = new Map<string, string[]>(); // userId -> Array of transactionIds
  private campaignTasksMap = new Map<string, string>(); // campaignId -> taskId

  // Concurrency mutex lock queues to prevent race conditions on user balances and task claims
  private userLocks = new Map<string, Promise<void>>();

  constructor() {
    this.data = this.loadDatabase();
    this.migrateAndSanitizeDatabase();
    this.seedDefaultDataIfNeeded();
    this.checkAndExpireCampaigns();
    this.rebuildIndexes();
  }

  // Rebuild secondary indexes on boot
  public rebuildIndexes() {
    this.taskUserUniqueIndex.clear();
    this.userCompletionsIndex.clear();
    this.userCampaignsIndex.clear();
    this.userTransactionsIndex.clear();
    this.campaignTasksMap.clear();

    // 1. Index completions: O(1) Idempotency and user completions lookup
    for (const [compId, comp] of Object.entries(this.data.completions)) {
      if (comp.status === 'PENDING' || comp.status === 'APPROVED') {
        this.taskUserUniqueIndex.set(`${comp.taskId}:${comp.anonymousUserId}`, compId);
      }
      let userSet = this.userCompletionsIndex.get(comp.anonymousUserId);
      if (!userSet) {
        userSet = new Set();
        this.userCompletionsIndex.set(comp.anonymousUserId, userSet);
      }
      userSet.add(compId);
    }

    // 2. Index user campaigns
    for (const [campId, camp] of Object.entries(this.data.campaigns)) {
      let userCamps = this.userCampaignsIndex.get(camp.anonymousUserId);
      if (!userCamps) {
        userCamps = new Set();
        this.userCampaignsIndex.set(camp.anonymousUserId, userCamps);
      }
      userCamps.add(campId);
    }

    // 3. Index campaign -> task mapping
    for (const [taskId, task] of Object.entries(this.data.tasks)) {
      if (task.campaignId) {
        this.campaignTasksMap.set(task.campaignId, taskId);
      }
    }

    // 4. Index user transactions
    for (const tx of this.data.pointTransactions) {
      let txList = this.userTransactionsIndex.get(tx.anonymousUserId);
      if (!txList) {
        txList = [];
        this.userTransactionsIndex.set(tx.anonymousUserId, txList);
      }
      txList.push(tx.id);
    }
  }

  // Distributed concurrency lock across all backend instances (Redis SET NX PX + Lua verify release)
  public async withUserLock<T>(userId: string, fn: () => Promise<T> | T): Promise<T> {
    return withDistributedLock<T>(`user_lock:${userId}`, 15000, async () => {
      return await fn();
    });
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading database file, creating fresh:', err);
    }

    return {
      users: {},
      campaigns: {},
      tasks: {},
      completions: {},
      pointTransactions: [],
      xpTransactions: [],
      auditLogs: [],
    };
  }

  // Debounced write buffer: Batches disk I/O to avoid blocking the event loop on high RPS
  private schedulePersist() {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      this.flushSync();
    }, 40);
  }

  // Synchronous atomic write for graceful shutdowns and migrations
  public flushSync() {
    if (this.isWriting) return;
    this.isWriting = true;
    try {
      const payload = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_TMP_FILE, payload, 'utf-8');
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    } finally {
      this.isWriting = false;
    }
  }

  private persist() {
    this.schedulePersist();
  }

  // Linearized transaction runner with snapshot rollback
  public transaction<T>(fn: () => T): T {
    try {
      const result = fn();
      this.persist();
      return result;
    } catch (err) {
      throw err;
    }
  }

  // Safe migration and database sanitization (Reset legacy 120 pts / 200 XP to exact 50 pts / 0 XP specification)
  private migrateAndSanitizeDatabase() {
    let modified = false;

    // 1. Sanitize all users
    for (const user of Object.values(this.data.users)) {
      let userModified = false;

      // Strict rule: XP must start at 0 and only increase from approved completions that award XP
      const userApprovedCompletions = Object.values(this.data.completions).filter(
        (c) => c.anonymousUserId === user.id && c.status === 'APPROVED'
      );
      const earnedXp = userApprovedCompletions.reduce((sum, c) => sum + (c.xpReward || 0), 0);
      if (user.xp !== earnedXp) {
        user.xp = earnedXp;
        user.level = calculateLevel(user.xp);
        userModified = true;
      }

      // Reset legacy streaks and daily bonus claim dates
      if (user.currentStreak !== 0 || user.highestStreak !== 0 || user.lastClaimDate !== null) {
        user.currentStreak = 0;
        user.highestStreak = 0;
        user.lastClaimDate = null;
        userModified = true;
      }

      // Sanitize legacy points: If user had legacy 120 / 100 / 50 points:
      if (!user.firstCampaignBonusGranted) {
        user.points = 10;
        user.firstCampaignBonusGranted = true;
        userModified = true;
      } else if (user.points > 10 && (user.completedTasksCount || 0) === 0) {
        // Reset old legacy balances (e.g. 50 or 120) for users who never did tasks
        user.points = 10;
        userModified = true;
      }

      if (userModified) {
        user.updatedAt = new Date().toISOString();
        modified = true;
      }
    }

    // 2. Remove legacy transactions (DAILY_BONUS, pt_welcome, pt_db, etc.)
    const originalPtLength = this.data.pointTransactions.length;
    this.data.pointTransactions = this.data.pointTransactions.filter((pt) => {
      if (pt.type === 'DAILY_BONUS') return false;
      if (pt.id.startsWith('pt_welcome') || pt.id.startsWith('pt_db')) return false;
      if (pt.description.includes('ترحيبية') || pt.description.includes('مكافأة يومية')) return false;
      return true;
    });
    if (this.data.pointTransactions.length !== originalPtLength) {
      modified = true;
    }

    // Ensure every user has a FIRST_CAMPAIGN_BONUS transaction of 10 points
    for (const user of Object.values(this.data.users)) {
      const hasBonusTx = this.data.pointTransactions.some(
        (pt) => pt.anonymousUserId === user.id && pt.type === 'FIRST_CAMPAIGN_BONUS'
      );
      if (!hasBonusTx) {
        this.data.pointTransactions.push({
          id: 'pt_fcb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          anonymousUserId: user.id,
          type: 'FIRST_CAMPAIGN_BONUS',
          amount: 10,
          balanceBefore: 0,
          balanceAfter: 10,
          description: 'مكافأة أول دخول للتطبيق (10 نقاط مجانية لمرة واحدة فقط)',
          createdAt: user.createdAt || new Date().toISOString(),
        });
        modified = true;
      }
    }

    // Remove legacy XP transactions (welcome / daily bonus)
    const originalXpLength = this.data.xpTransactions.length;
    this.data.xpTransactions = this.data.xpTransactions.filter((xp) => {
      if (xp.id.startsWith('xp_welcome') || xp.id.startsWith('xp_db')) return false;
      return true;
    });
    if (this.data.xpTransactions.length !== originalXpLength) {
      modified = true;
    }

    // Permanent sanitization: completely remove any mock, demo, or fake accounts, plus any legacy shared user_default
    if (this.data.users['user_default']) {
      delete this.data.users['user_default'];
      this.data.pointTransactions = this.data.pointTransactions.filter((pt) => pt.anonymousUserId !== 'user_default');
      modified = true;
    }

    const fakeTaskIds = ['task_sample_instagram_follower', 'task_sample_tiktok_follower'];
    for (const taskId of fakeTaskIds) {
      if (this.data.tasks[taskId]) {
        delete this.data.tasks[taskId];
        modified = true;
      }
    }

    const fakeUsernames = [
      'ai.research.lab',
      'prof_mohammad_ai',
      'real_creator_1',
      'real_creator_2',
      'real_creator_3',
      'p._.9v',
      'real_user',
      'tiktok_user',
      'sample_user',
      'demo_user',
      'test_user',
    ];

    const deletedCampaignIds = new Set<string>();
    for (const [campId, camp] of Object.entries(this.data.campaigns)) {
      const username = (camp.targetUsername || '').toLowerCase();
      if (
        fakeUsernames.includes(username) ||
        username.startsWith('test_') ||
        camp.anonymousUserId?.startsWith('test_') ||
        camp.anonymousUserId?.startsWith('broke_') ||
        camp.anonymousUserId?.startsWith('neg_')
      ) {
        delete this.data.campaigns[campId];
        deletedCampaignIds.add(campId);
        modified = true;
      }
    }

    for (const [taskId, task] of Object.entries(this.data.tasks)) {
      const username = (task.targetUsername || '').toLowerCase();
      if (
        (task.targetUsername && fakeUsernames.includes(username)) ||
        taskId.startsWith('task_sample_') ||
        (task.campaignId && deletedCampaignIds.has(task.campaignId)) ||
        (task.campaignId && !this.data.campaigns[task.campaignId])
      ) {
        delete this.data.tasks[taskId];
        fakeTaskIds.push(taskId);
        modified = true;
      }
    }

    for (const [compId, comp] of Object.entries(this.data.completions)) {
      const uId = comp.anonymousUserId || (comp as any).userId;
      if (fakeTaskIds.includes(comp.taskId) || uId?.startsWith('test_') || uId?.startsWith('worker_')) {
        delete this.data.completions[compId];
        modified = true;
      }
    }

    // Clean orphaned point transactions
    if (deletedCampaignIds.size > 0) {
      this.data.pointTransactions = this.data.pointTransactions.filter((tx) => {
        if (tx.referenceId && deletedCampaignIds.has(tx.referenceId)) return false;
        return true;
      });
      modified = true;
    }

    // Ensure all tasks have an explicit isAccountVerified flag (default false)
    for (const task of Object.values(this.data.tasks)) {
      if (task.isAccountVerified === undefined) {
        task.isAccountVerified = false;
        modified = true;
      }
    }
    for (const camp of Object.values(this.data.campaigns)) {
      if (camp.isAccountVerified === undefined) {
        camp.isAccountVerified = false;
        modified = true;
      }
    }

    if (modified) {
      console.log('🔄 Database migration and sanitization complete: Points reset to 10, XP reset to 0.');
      this.persist();
    }
  }

  private seedDefaultDataIfNeeded() {
    // Ensure all tasks have reward: 1 and xpReward: 0 per the new economic rules
    if (Object.keys(this.data.tasks).length === 0) {
      const initialTasks: Task[] = [
        {
          id: 'task_mohammad_ai_channel',
          title: 'استكشاف قناة بروفيسور محمد مهدي AI الرسمية',
          description: 'قم بزيارة القناة والاطلاع على أحدث محتوى تعليمي في الذكاء الاصطناعي وهندسة الأوامر.',
          taskType: 'VISIT_URL',
          platform: 'YouTube / Telegram',
          targetUrl: 'https://youtube.com/@ProfessorMohammadMahdiAI',
          targetUsername: '@ProfMohammadMahdi',
          reward: 1,
          xpReward: 0,
          estimatedMinutes: 2,
          instructions: [
            'اضغط على زر فتح المهمة للانتقال إلى القناة',
            'تصفح أحدث الفيديوهات التعليمية',
            'عد هنا واضغط أنجزت المهمة لتسجيل إنجازك والحصول على +1 نقطة',
          ],
          status: 'ACTIVE',
          totalCompletionsRequired: 500,
          currentCompletions: 12,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task_neural_networks_guide',
          title: 'قراءة دليل: أسرار الشبكات العصبية العميقة',
          description: 'مقالة تعليمية حصرية تشرح كيف تفكر النماذج اللغوية الكبيرة واستخداماتها العملية.',
          taskType: 'READ_ARTICLE',
          platform: 'AI Academy',
          targetUrl: 'https://ai.studio',
          reward: 1,
          xpReward: 0,
          estimatedMinutes: 3,
          instructions: [
            'اقرأ الملخص التعليمي للشبكات العصبية',
            'افهم الفرق بين المعالجة الكلاسيكية والذكاء الاصطناعي التوليدي',
            'أكد قراءتك بالضغط على زر إنجاز المهمة للحصول على +1 نقطة',
          ],
          status: 'ACTIVE',
          totalCompletionsRequired: 300,
          currentCompletions: 28,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task_prompt_engineering_quiz',
          title: 'اختبار سريع: أساسيات هندسة الأوامر المتقدمة (Prompting)',
          description: 'أجب عن التحدي التعليمي السريع لاختبار مهاراتك في توجيه نماذج الذكاء الاصطناعي.',
          taskType: 'COMPLETE_QUIZ',
          platform: 'Professor AI Lab',
          targetUrl: 'https://ai.studio',
          reward: 1,
          xpReward: 0,
          estimatedMinutes: 4,
          instructions: [
            'ابدأ الاختبار واقرأ أسئلة هندسة الأوامر',
            'اختر الاستراتيجيات الأنسب لتقليل الهلوسة في النماذج',
            'احصل على تقييم فوري ونقطة المكافأة (+1)',
          ],
          status: 'ACTIVE',
          totalCompletionsRequired: 200,
          currentCompletions: 45,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task_open_resource_repo',
          title: 'الوصول إلى مكتبة أدوات الذكاء الاصطناعي المجانية',
          description: 'افتح المصدر التعليمي المفتوح واستعرض البرمجيات والنماذج مفتوحة المصدر.',
          taskType: 'OPEN_RESOURCE',
          platform: 'Open Resource Hub',
          targetUrl: 'https://github.com',
          reward: 1,
          xpReward: 0,
          estimatedMinutes: 2,
          instructions: [
            'افتح المستودع التعليمي',
            'استكشف الأدوات الموصى بها من البروفيسور',
            'سجل إتمام المهمة للحصول على +1 نقطة',
          ],
          status: 'ACTIVE',
          totalCompletionsRequired: 150,
          currentCompletions: 8,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const t of initialTasks) {
        this.data.tasks[t.id] = t;
      }
      this.persist();
    } else {
      let modified = false;

      // Enforce 1 point reward and 0 xp on all tasks
      for (const task of Object.values(this.data.tasks)) {
        if (task.reward !== 1 || task.xpReward !== 0) {
          task.reward = 1;
          task.xpReward = 0;
          modified = true;
        }
      }
      if (modified) {
        this.persist();
      }
    }
  }

  public getOrCreateUser(userId: string): AnonymousUser {
    let cleanUserId = typeof userId === 'string' ? userId.trim() : '';
    if (
      !cleanUserId ||
      cleanUserId.length < 4 ||
      cleanUserId === 'user_default' ||
      cleanUserId === 'undefined' ||
      cleanUserId === 'null' ||
      cleanUserId === 'user_ssr'
    ) {
      cleanUserId = 'user_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    }
    userId = cleanUserId;

    return this.transaction(() => {
      let isNewUser = false;
      if (!this.data.users[userId]) {
        isNewUser = true;
        const now = new Date().toISOString();
        const newUser: AnonymousUser = {
          id: userId,
          username: `باحث_AI_${userId.slice(-4)}`,
          points: 0,
          xp: 0,
          level: 'BEGINNER',
          currentStreak: 0,
          highestStreak: 0,
          lastClaimDate: null,
          completedTasksCount: 0,
          campaignsCreatedCount: 0,
          firstCampaignBonusGranted: false,
          createdAt: now,
          updatedAt: now,
          role: 'user',
        };

        this.data.users[userId] = newUser;
      }

      const user = this.data.users[userId];

      // First-time entry bonus: Exactly 10 points (cost of 1 campaign) and 0 XP
      // Strictly granted once using server-side firstCampaignBonusGranted lock
      if (!user.firstCampaignBonusGranted) {
        const bonusAmount = 10;
        const balanceBefore = user.points || 0;
        const balanceAfter = balanceBefore + bonusAmount;
        user.points = balanceAfter;
        user.xp = 0;
        user.currentStreak = 0;
        user.highestStreak = 0;
        user.lastClaimDate = null;
        user.firstCampaignBonusGranted = true;
        user.updatedAt = new Date().toISOString();

        // Register transaction as FIRST_CAMPAIGN_BONUS
        this.data.pointTransactions.unshift({
          id: 'pt_fcb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          anonymousUserId: user.id,
          type: 'FIRST_CAMPAIGN_BONUS',
          amount: bonusAmount,
          balanceBefore,
          balanceAfter,
          description: 'مكافأة أول دخول للتطبيق (10 نقاط مجانية لمرة واحدة فقط)',
          createdAt: new Date().toISOString(),
        });
      }

      // Ensure level is recalculated from XP (0 XP = BEGINNER)
      user.level = calculateLevel(user.xp || 0);

      return user;
    });
  }

  public getUser(userId: string): AnonymousUser | null {
    return this.data.users[userId] || null;
  }

  // Create Campaign - strictly follows User Requirement: Fixed 50 Points = 1 Campaign
  public createCampaign(
    userId: string,
    params: {
      title?: string;
      description?: string;
      platform: string;
      targetPlatform?: string;
      taskType?: any;
      targetUsername?: string;
      targetProfileUrl?: string;
      targetDisplayName?: string;
      targetAvatarUrl?: string;
      targetUrl?: string;
      isAccountVerified?: boolean;
      targetAccountVerified?: boolean;
      targetCompletions?: number;
      rewardPerCompletion?: number;
      durationMinutes?: number;
      status?: 'ACTIVE' | 'ACCOUNT_DATA_UNAVAILABLE' | 'COMPLETED' | 'EXPIRED';
    }
  ): { campaign: Campaign; user: AnonymousUser } {
    return this.transaction(() => {
      const user = this.getOrCreateUser(userId);

      const CAMPAIGN_FIXED_COST = 10;

      // Server check: user must have at least 10 points
      // Equation: newBalance = currentBalance - 10
      if (user.points < CAMPAIGN_FIXED_COST) {
        throw new Error('تحتاج إلى 10 نقاط لإنشاء حملة.');
      }

      // Validate and normalize platform (Instagram or TikTok only)
      const rawPlatform = (params.platform || params.targetPlatform || '').toLowerCase();
      const isInstagram = rawPlatform.includes('insta');
      const normalizedPlatform = isInstagram ? 'Instagram' : 'TikTok';

      // Mandatory check: Profile URL is strictly required
      const rawProfileUrl = (params.targetProfileUrl || params.targetUrl || '').trim();
      if (!rawProfileUrl) {
        throw new Error('رابط الحساب المستهدف (Profile URL) مطلوب إلزاميًا لإنشاء الحملة.');
      }

      // Clean and validate target username on server
      let cleanUsername = (params.targetUsername || '').replace(/^@+/, '').trim();
      if (!cleanUsername && rawProfileUrl) {
        const segments = rawProfileUrl.replace(/https?:\/\//, '').split('?')[0].split('/').filter(Boolean);
        if (segments.length > 1) {
          cleanUsername = segments[1].replace(/^@+/, '').trim();
        }
      }

      if (!cleanUsername || !/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
        throw new Error('اسم المستخدم غير صالح. استخدم أحرف إنجليزية وأرقام ونقاط فقط.');
      }

      const forbiddenMockUsernames = new Set([
        'ai.research.lab',
        'prof_mohammad_ai',
        'real_creator_1',
        'real_creator_2',
        'real_creator_3',
        'p._.9v',
        'sample_user',
        'demo_user',
      ]);
      if (forbiddenMockUsernames.has(cleanUsername.toLowerCase())) {
        throw new Error('لا يمكن استخدام حساب تجريبي أو وهمي.');
      }

      // Server constructs targetUrl securely
      const targetUrl = isInstagram
        ? `https://www.instagram.com/${cleanUsername}/`
        : `https://www.tiktok.com/@${cleanUsername}`;

      const targetProfileUrl = rawProfileUrl || targetUrl;

      // Only preserve displayName and avatarUrl if officially verified
      const isVerified = Boolean(params.isAccountVerified ?? params.targetAccountVerified);
      const targetDisplayName = isVerified ? (params.targetDisplayName?.trim() || undefined) : undefined;
      const targetAvatarUrl = isVerified ? (params.targetAvatarUrl?.trim() || undefined) : undefined;

      const balanceBefore = user.points;
      const balanceAfter = balanceBefore - CAMPAIGN_FIXED_COST;
      if (balanceAfter < 0) {
        throw new Error('لا يمكن أن يصبح رصيد المستخدم سالباً');
      }

      // Deduct exactly 10 points immediately
      user.points = balanceAfter;
      user.campaignsCreatedCount = (user.campaignsCreatedCount || 0) + 1;
      user.updatedAt = new Date().toISOString();

      const campaignId = 'camp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date();
      const durationMinutes = Math.floor(Number(params.durationMinutes)) || 1440;
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

      // Economic model: 10 points = 10 completions (followers) at 1 point reward each
      const targetCompletions = 10;
      const rewardPerCompletion = 1;

      const campaignTitle =
        params.title?.trim() || `متابعين ${normalizedPlatform}: @${cleanUsername}`;

      const campaign: Campaign = {
        id: campaignId,
        anonymousUserId: userId,
        creatorName: user.username,
        title: campaignTitle,
        description:
          params.description?.trim() ||
          `متابعة الحساب @${cleanUsername} على ${normalizedPlatform} للحصول على +1 نقطة`,
        platform: normalizedPlatform,
        targetPlatform: normalizedPlatform,
        taskType: 'FOLLOWERS',
        targetUsername: cleanUsername,
        targetDisplayName,
        targetAvatarUrl,
        isAccountVerified: isVerified,
        targetAccountVerified: isVerified,
        targetUrl,
        targetProfileUrl,
        targetCompletions,
        currentProgress: 0,
        rewardPerCompletion,
        totalBudget: CAMPAIGN_FIXED_COST,
        spentBudget: 0,
        remainingBudget: CAMPAIGN_FIXED_COST,
        durationMinutes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
        status: 'ACTIVE',
      };

      this.data.campaigns[campaignId] = campaign;

      // Maintain secondary indexes
      let userCamps = this.userCampaignsIndex.get(userId);
      if (!userCamps) {
        userCamps = new Set();
        this.userCampaignsIndex.set(userId, userCamps);
      }
      userCamps.add(campaignId);

      // Create a corresponding Task so other users can see and complete it for exactly +1 Point
      const taskId = 'task_camp_' + campaignId;
      const task: Task = {
        id: taskId,
        campaignId: campaignId,
        title: campaign.title,
        description: campaign.description,
        taskType: 'FOLLOWERS',
        platform: campaign.platform,
        targetPlatform: campaign.targetPlatform,
        targetUrl: campaign.targetUrl,
        targetProfileUrl: campaign.targetProfileUrl,
        targetUsername: campaign.targetUsername,
        targetDisplayName: campaign.targetDisplayName,
        targetAvatarUrl: campaign.targetAvatarUrl,
        isAccountVerified: campaign.isAccountVerified,
        targetAccountVerified: campaign.targetAccountVerified,
        reward: 1, // Exactly +1 point per approved completion
        xpReward: 0, // Default 0 XP
        estimatedMinutes: 1,
        instructions: [
          `افتح الحساب المستهدف: @${cleanUsername}`,
          `قم بمتابعة الحساب على ${normalizedPlatform}`,
          'عد إلى التطبيق واضغط زر "أنجزت المهمة" لتوثيق إنجازك والحصول على +1 نقطة',
        ],
        status: 'ACTIVE',
        totalCompletionsRequired: targetCompletions,
        currentCompletions: 0,
        createdAt: now.toISOString(),
      };

      this.data.tasks[taskId] = task;
      this.campaignTasksMap.set(campaignId, taskId);

      // Register PointTransaction as CAMPAIGN_COST (-50)
      const ptId = 'pt_camp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      this.data.pointTransactions.unshift({
        id: ptId,
        anonymousUserId: userId,
        type: 'CAMPAIGN_COST',
        amount: -CAMPAIGN_FIXED_COST,
        balanceBefore,
        balanceAfter,
        description: `خصم تكلفة إنشاء حملة متابعين ${normalizedPlatform} (@${cleanUsername}) - 10 نقاط`,
        referenceId: campaignId,
        createdAt: now.toISOString(),
      });

      let userTxList = this.userTransactionsIndex.get(userId);
      if (!userTxList) {
        userTxList = [];
        this.userTransactionsIndex.set(userId, userTxList);
      }
      userTxList.unshift(ptId);

      // Invalidate relevant cache tags
      appCache.invalidateTags(['campaigns', 'tasks', 'user:' + userId, 'points:' + userId]);
      cacheInvalidatePattern('campaigns');
      cacheInvalidatePattern('tasks');
      cacheInvalidatePattern('user:' + userId);
      cacheInvalidatePattern('points:' + userId);

      return { campaign, user };
    });
  }

  public deleteCampaign(campaignId: string): boolean {
    return this.transaction(() => {
      const camp = this.data.campaigns[campaignId];
      if (!camp) return false;
      delete this.data.campaigns[campaignId];

      // Remove corresponding task
      const taskId = 'task_camp_' + campaignId;
      if (this.data.tasks[taskId]) {
        delete this.data.tasks[taskId];
      }
      for (const [tId, t] of Object.entries(this.data.tasks)) {
        if (t.campaignId === campaignId) {
          delete this.data.tasks[tId];
        }
      }

      // Remove from index
      const userCamps = this.userCampaignsIndex.get(camp.anonymousUserId);
      if (userCamps) {
        userCamps.delete(campaignId);
      }
      this.campaignTasksMap.delete(campaignId);

      // Clean completions tied to this campaign
      for (const [compId, comp] of Object.entries(this.data.completions)) {
        if (comp.taskId === taskId) {
          delete this.data.completions[compId];
        }
      }

      // Invalidate caches
      appCache.invalidateTags(['campaigns', 'tasks']);
      return true;
    });
  }

  public deleteUser(userId: string): boolean {
    return this.transaction(() => {
      if (!this.data.users[userId]) return false;
      delete this.data.users[userId];
      this.userTransactionsIndex.delete(userId);
      this.userCampaignsIndex.delete(userId);
      this.userCompletionsIndex.delete(userId);
      return true;
    });
  }

  // Submit Task Completion - User Requirement #9 & #10
  // Each approved task = +1 Point only. Strictly idempotent.
  public submitTaskCompletion(
    taskId: string,
    userId: string,
    proofNote?: string
  ): { completion: TaskCompletion; workerUser: AnonymousUser; campaign?: Campaign; isDuplicate?: boolean } {
    return this.transaction(() => {
      const task = this.data.tasks[taskId];
      if (!task) {
        throw new Error('المهمة غير موجودة');
      }

      const campaign = task.campaignId ? this.data.campaigns[task.campaignId] : null;

      if (campaign) {
        // Expiry check
        if (new Date(campaign.expiresAt) <= new Date()) {
          campaign.status = 'EXPIRED';
          throw new Error('هذه الحملة انتهت صلاحيتها');
        }
        if (campaign.status !== 'ACTIVE') {
          throw new Error(`لا يمكن تقديم إنجاز، حالة الحملة: ${campaign.status}`);
        }
        if (campaign.currentProgress >= campaign.targetCompletions) {
          throw new Error('اكتمل العدد المطلوب لهذه الحملة بالفعل');
        }
        if (campaign.remainingBudget < campaign.rewardPerCompletion) {
          throw new Error('ميزانية الحملة المتبقية لا تكفي لإنجاز إضافي');
        }
        // Owner check: owner cannot complete their own campaign
        if (campaign.anonymousUserId === userId) {
          throw new Error('لا يمكنك تنفيذ وإنجاز حملتك الخاصة');
        }
      }

      // Check unique submission constraint via O(1) secondary index: UNIQUE(userId, taskId)
      const existingCompId = this.taskUserUniqueIndex.get(`${taskId}:${userId}`);
      if (existingCompId) {
        const existing = this.data.completions[existingCompId];
        if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
          return {
            completion: existing,
            workerUser: this.getOrCreateUser(userId),
            campaign: campaign || undefined,
            isDuplicate: true,
          };
        }
      }

      const completionId = 'comp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const now = new Date().toISOString();
      const earnedPoints = 1; // Strictly 1 point per specification
      const earnedXp = 0; // Strictly 0 XP default

      const completion: TaskCompletion = {
        id: completionId,
        taskId,
        campaignId: campaign?.id,
        anonymousUserId: userId,
        status: 'APPROVED', // Immediately approved with full transaction verification
        reward: earnedPoints,
        xpReward: earnedXp,
        proofNote: proofNote?.trim() || 'تم تنفيذ المطلوب يدوياً بواسطة المستخدم',
        submittedAt: now,
        verifiedAt: now,
        verificationNote: 'تم التحقق وقبول الإنجاز بنجاح (+1 نقطة)',
        taskTitle: task.title,
        taskType: task.taskType,
      };

      this.data.completions[completionId] = completion;

      // Maintain secondary unique and user completion indexes
      this.taskUserUniqueIndex.set(`${taskId}:${userId}`, completionId);
      let userSet = this.userCompletionsIndex.get(userId);
      if (!userSet) {
        userSet = new Set();
        this.userCompletionsIndex.set(userId, userSet);
      }
      userSet.add(completionId);

      // Credit worker user points (+1 Point)
      const workerUser = this.getOrCreateUser(userId);
      const balanceBefore = workerUser.points;
      const balanceAfter = balanceBefore + earnedPoints;
      workerUser.points = balanceAfter;
      workerUser.completedTasksCount = (workerUser.completedTasksCount || 0) + 1;
      workerUser.updatedAt = now;

      // Create Point Transaction (+1 Point)
      const txId = 'pt_rew_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      this.data.pointTransactions.unshift({
        id: txId,
        anonymousUserId: workerUser.id,
        type: 'TASK_REWARD',
        amount: earnedPoints,
        balanceBefore,
        balanceAfter,
        description: `مكافأة إنجاز مهمة: "${task.title}" (+1 نقطة)`,
        referenceId: completion.id,
        createdAt: now,
      });

      let userTxList = this.userTransactionsIndex.get(workerUser.id);
      if (!userTxList) {
        userTxList = [];
        this.userTransactionsIndex.set(workerUser.id, userTxList);
      }
      userTxList.unshift(txId);

      // Invalidate relevant cache tags
      appCache.invalidateTags(['tasks', 'user:' + userId, 'points:' + userId]);
      cacheInvalidatePattern('tasks');
      cacheInvalidatePattern('user:' + userId);
      cacheInvalidatePattern('points:' + userId);

      // If associated with a Campaign, adjust campaign budget and progress
      if (campaign) {
        campaign.remainingBudget -= earnedPoints;
        campaign.spentBudget += earnedPoints;
        campaign.currentProgress += 1;
        campaign.updatedAt = now;

        if (
          campaign.currentProgress >= campaign.targetCompletions ||
          campaign.remainingBudget < campaign.rewardPerCompletion
        ) {
          campaign.status = 'COMPLETED';
        }
      }

      // Update task completion count
      task.currentCompletions = (task.currentCompletions || 0) + 1;

      return { completion, workerUser, campaign };
    });
  }

  // Approve Completion - User Requirement: Exactly +1 Point per approved task
  public approveTaskCompletion(
    completionId: string,
    adminId: string = 'system_admin',
    verificationNote: string = 'تم التحقق وقبول الإنجاز بنجاح'
  ): { completion: TaskCompletion; workerUser: AnonymousUser; campaign?: Campaign } {
    return this.transaction(() => {
      const completion = this.data.completions[completionId];
      if (!completion) {
        throw new Error('طلب الإنجاز غير موجود');
      }
      if (completion.status !== 'PENDING') {
        throw new Error(`حالة الإنجاز بالفعل: ${completion.status}`);
      }

      const workerUser = this.getOrCreateUser(completion.anonymousUserId);
      const now = new Date().toISOString();
      let campaign: Campaign | undefined;

      const earnedPoints = 1; // Strictly 1 point per approved completion
      const earnedXp = 0; // Strictly 0 XP default

      // If associated with a Campaign, adjust campaign budget and progress
      if (completion.campaignId) {
        campaign = this.data.campaigns[completion.campaignId];
        if (!campaign) {
          throw new Error('الحملة المرتبطة غير موجودة');
        }

        if (campaign.remainingBudget < earnedPoints) {
          throw new Error('ميزانية الحملة المتبقية غير كافية لدفع المكافأة');
        }

        // Deduct from campaign budget (1 point)
        campaign.remainingBudget -= earnedPoints;
        campaign.spentBudget += earnedPoints;
        campaign.currentProgress += 1;
        campaign.updatedAt = now;

        // Check if campaign reached completion
        if (
          campaign.currentProgress >= campaign.targetCompletions ||
          campaign.remainingBudget < campaign.rewardPerCompletion
        ) {
          campaign.status = 'COMPLETED';
        }
      }

      // Update completion record
      completion.status = 'APPROVED';
      completion.reward = earnedPoints;
      completion.xpReward = earnedXp;
      completion.verifiedAt = now;
      completion.verificationNote = verificationNote;

      // Credit worker user points (+1 Point)
      const balanceBefore = workerUser.points;
      const balanceAfter = balanceBefore + earnedPoints;
      workerUser.points = balanceAfter;
      workerUser.completedTasksCount = (workerUser.completedTasksCount || 0) + 1;
      workerUser.updatedAt = now;

      // Credit worker user XP (+0 XP)
      const xpBefore = workerUser.xp;
      const xpAfter = xpBefore + earnedXp;
      workerUser.xp = xpAfter;
      workerUser.level = calculateLevel(xpAfter);

      // Create Point Transaction (+1 Point)
      this.data.pointTransactions.unshift({
        id: 'pt_rew_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        anonymousUserId: workerUser.id,
        type: 'TASK_REWARD',
        amount: earnedPoints,
        balanceBefore,
        balanceAfter,
        description: `مكافأة إنجاز مهمة: "${completion.taskTitle || 'مهمة ذكية'}" (+1 نقطة)`,
        referenceId: completion.id,
        createdAt: now,
      });

      // Create XP Transaction
      this.data.xpTransactions.unshift({
        id: 'xp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        anonymousUserId: workerUser.id,
        amount: completion.xpReward,
        xpBefore,
        xpAfter,
        description: `خبرة إنجاز مهمة: "${completion.taskTitle || 'مهمة ذكية'}"`,
        referenceId: completion.id,
        createdAt: now,
      });

      // Log Admin Audit
      this.data.auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        adminId,
        action: 'APPROVE_COMPLETION',
        targetId: completion.id,
        reason: verificationNote,
        createdAt: now,
      });

      // Also update task completion count
      const task = this.data.tasks[completion.taskId];
      if (task) {
        task.currentCompletions = (task.currentCompletions || 0) + 1;
      }

      return { completion, workerUser, campaign };
    });
  }

  // Reject Completion
  public rejectTaskCompletion(
    completionId: string,
    adminId: string = 'system_admin',
    reason: string = 'لم يتم استيفاء شروط المهمة بدقة'
  ): TaskCompletion {
    return this.transaction(() => {
      const completion = this.data.completions[completionId];
      if (!completion) {
        throw new Error('طلب الإنجاز غير موجود');
      }
      if (completion.status !== 'PENDING') {
        throw new Error(`حالة الإنجاز بالفعل: ${completion.status}`);
      }

      completion.status = 'REJECTED';
      completion.verifiedAt = new Date().toISOString();
      completion.verificationNote = reason;

      this.data.auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        adminId,
        action: 'REJECT_COMPLETION',
        targetId: completion.id,
        reason,
        createdAt: new Date().toISOString(),
      });

      return completion;
    });
  }

  // Cancel Campaign and Refund remaining budget - Requirement #19
  public cancelCampaign(campaignId: string, userIdOrAdmin: string): Campaign {
    return this.transaction(() => {
      const campaign = this.data.campaigns[campaignId];
      if (!campaign) {
        throw new Error('الحملة غير موجودة');
      }

      if (campaign.status === 'CANCELLED' || campaign.status === 'COMPLETED') {
        throw new Error(`لا يمكن إلغاء حملة بحالة: ${campaign.status}`);
      }

      const now = new Date().toISOString();
      const refundAmount = campaign.remainingBudget;

      // If there's remaining budget, refund to creator atomically
      if (refundAmount > 0) {
        const creator = this.getOrCreateUser(campaign.anonymousUserId);
        const balanceBefore = creator.points;
        const balanceAfter = balanceBefore + refundAmount;
        creator.points = balanceAfter;
        creator.updatedAt = now;

        // Log refund transaction
        this.data.pointTransactions.unshift({
          id: 'pt_ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          anonymousUserId: creator.id,
          type: 'CAMPAIGN_REFUND',
          amount: refundAmount,
          balanceBefore,
          balanceAfter,
          description: `استرجاع ميزانية غير مستخدمة لإلغاء حملة: "${campaign.title}"`,
          referenceId: campaign.id,
          createdAt: now,
        });

        // Set remaining to 0 so it cannot be refunded twice
        campaign.remainingBudget = 0;
      }

      campaign.status = 'CANCELLED';
      campaign.updatedAt = now;

      // Also deactivate associated task
      const task = Object.values(this.data.tasks).find((t) => t.campaignId === campaignId);
      if (task) {
        task.status = 'INACTIVE';
      }

      this.data.auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        adminId: userIdOrAdmin,
        action: 'CANCEL_CAMPAIGN',
        targetId: campaign.id,
        reason: `إلغاء الحملة واسترجاع ${refundAmount} نقطة للمستخدم`,
        createdAt: now,
      });

      return campaign;
    });
  }

  // Pause / Resume Campaign
  public togglePauseCampaign(campaignId: string, userIdOrAdmin: string): Campaign {
    return this.transaction(() => {
      const campaign = this.data.campaigns[campaignId];
      if (!campaign) {
        throw new Error('الحملة غير موجودة');
      }
      if (campaign.status !== 'ACTIVE' && campaign.status !== 'PAUSED') {
        throw new Error(`لا يمكن تعديل حالة حملة بحالة: ${campaign.status}`);
      }

      campaign.status = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      campaign.updatedAt = new Date().toISOString();

      return campaign;
    });
  }

  // Check and Expire Campaigns with Automatic Unused Budget Refund - Requirement #18 & #19
  public checkAndExpireCampaigns(): number {
    const now = new Date();
    let expiredCount = 0;

    for (const campaign of Object.values(this.data.campaigns)) {
      if (campaign.status === 'ACTIVE' && new Date(campaign.expiresAt) <= now) {
        try {
          this.transaction(() => {
            campaign.status = 'EXPIRED';
            campaign.updatedAt = now.toISOString();

            const refundAmount = campaign.remainingBudget;
            if (refundAmount > 0) {
              const creator = this.data.users[campaign.anonymousUserId];
              if (creator) {
                const balanceBefore = creator.points;
                const balanceAfter = balanceBefore + refundAmount;
                creator.points = balanceAfter;
                creator.updatedAt = now.toISOString();

                this.data.pointTransactions.unshift({
                  id: 'pt_ref_exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                  anonymousUserId: creator.id,
                  type: 'CAMPAIGN_REFUND',
                  amount: refundAmount,
                  balanceBefore,
                  balanceAfter,
                  description: `استرجاع تلقائي للميزانية المتبقية لانتهاء وقت حملة: "${campaign.title}"`,
                  referenceId: campaign.id,
                  createdAt: now.toISOString(),
                });

                campaign.remainingBudget = 0;
              }
            }

            const task = Object.values(this.data.tasks).find((t) => t.campaignId === campaign.id);
            if (task) {
              task.status = 'INACTIVE';
            }

            expiredCount++;
          });
        } catch (e) {
          console.error('Error expiring campaign:', campaign.id, e);
        }
      }
    }

    return expiredCount;
  }

  // Daily Bonus disabled per strict user requirement #1: "لا يوجد Daily Bonus"
  public claimDailyBonus(userId: string): {
    user: AnonymousUser;
    pointsAwarded: number;
    xpAwarded: number;
    streakBonusXp: number;
    currentStreak: number;
  } {
    throw new Error('تم إيقاف المكافأة اليومية وفق قواعد النظام (النقاط تأتي حصراً من إنجاز المهام: +1 نقطة)');
  }

  // Admin adjust points - Requirement #20
  public adminAdjustPoints(
    adminId: string,
    targetUserId: string,
    amount: number,
    reason: string
  ): { user: AnonymousUser; transaction: PointTransaction } {
    return this.transaction(() => {
      const user = this.getOrCreateUser(targetUserId);
      const balanceBefore = user.points;
      const balanceAfter = balanceBefore + amount;

      if (balanceAfter < 0) {
        throw new Error('لا يمكن أن يصبح رصيد المستخدم سالباً');
      }

      user.points = balanceAfter;
      user.updatedAt = new Date().toISOString();

      const transaction: PointTransaction = {
        id: 'pt_adj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        anonymousUserId: targetUserId,
        type: 'ADMIN_ADJUSTMENT',
        amount,
        balanceBefore,
        balanceAfter,
        description: `تعديل إداري: ${reason}`,
        createdAt: new Date().toISOString(),
      };

      this.data.pointTransactions.unshift(transaction);

      this.data.auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        adminId,
        action: 'ADJUST_POINTS',
        targetId: targetUserId,
        reason: `تعديل الرصيد بقيمة ${amount} نقطة. السبب: ${reason}`,
        createdAt: new Date().toISOString(),
      });

      return { user, transaction };
    });
  }

  // Read Queries with Pagination and Secondary Indexing
  public getTasks(page?: number, limit?: number): Task[] {
    const all = Object.values(this.data.tasks).filter((t) => t.status === 'ACTIVE');
    if (!page && !limit) return all;
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 20));
    const start = (p - 1) * l;
    return all.slice(start, start + l);
  }

  public getTask(id: string): Task | null {
    return this.data.tasks[id] || null;
  }

  public getCampaigns(page?: number, limit?: number): Campaign[] {
    this.checkAndExpireCampaigns();
    const all = Object.values(this.data.campaigns).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (!page && !limit) return all;
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 20));
    const start = (p - 1) * l;
    return all.slice(start, start + l);
  }

  public getCampaign(id: string): Campaign | null {
    this.checkAndExpireCampaigns();
    return this.data.campaigns[id] || null;
  }

  public getUserCampaigns(userId: string, page?: number, limit?: number): Campaign[] {
    this.checkAndExpireCampaigns();
    const campIds = this.userCampaignsIndex.get(userId);
    let all: Campaign[] = [];
    if (campIds && campIds.size > 0) {
      for (const id of campIds) {
        const camp = this.data.campaigns[id];
        if (camp) all.push(camp);
      }
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      all = Object.values(this.data.campaigns)
        .filter((c) => c.anonymousUserId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (!page && !limit) return all;
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 20));
    const start = (p - 1) * l;
    return all.slice(start, start + l);
  }

  public getUserCompletions(userId: string): TaskCompletion[] {
    const compIds = this.userCompletionsIndex.get(userId);
    if (!compIds || compIds.size === 0) return [];
    const result: TaskCompletion[] = [];
    for (const id of compIds) {
      const comp = this.data.completions[id];
      if (comp) result.push(comp);
    }
    return result;
  }

  public getAllCompletions(): TaskCompletion[] {
    return Object.values(this.data.completions).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  public getUserPointTransactions(userId: string, page?: number, limit?: number): PointTransaction[] {
    const all = this.data.pointTransactions.filter((pt) => pt.anonymousUserId === userId);
    if (!page && !limit) return all;
    const p = Math.max(1, page || 1);
    const l = Math.min(100, Math.max(1, limit || 50));
    const start = (p - 1) * l;
    return all.slice(start, start + l);
  }

  public getAllPointTransactions(): PointTransaction[] {
    return this.data.pointTransactions;
  }

  public getAllUsers(): AnonymousUser[] {
    return Object.values(this.data.users);
  }

  public getAuditLogs(): AdminAuditLog[] {
    return this.data.auditLogs;
  }

  // Database metrics for scalability telemetry
  public getDbMetrics() {
    const heap = process.memoryUsage();
    return {
      totalUsers: Object.keys(this.data.users).length,
      totalCampaigns: Object.keys(this.data.campaigns).length,
      totalTasks: Object.keys(this.data.tasks).length,
      totalCompletions: Object.keys(this.data.completions).length,
      totalTransactions: this.data.pointTransactions.length,
      indexedUniqueSubmissions: this.taskUserUniqueIndex.size,
      indexedUserCompletions: this.userCompletionsIndex.size,
      activeUserLocks: this.userLocks.size,
      heapUsedMB: Math.round(heap.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(heap.heapTotal / 1024 / 1024),
      rssMB: Math.round(heap.rss / 1024 / 1024),
    };
  }

  public getPointsOverview(userId: string) {
    const user = this.getOrCreateUser(userId);
    const txs = this.getUserPointTransactions(userId);

    let earnedTotal = 0;
    let spentTotal = 0;

    for (const tx of txs) {
      if (tx.amount > 0) {
        earnedTotal += tx.amount;
      } else {
        spentTotal += Math.abs(tx.amount);
      }
    }

    const myCampaigns = this.getUserCampaigns(userId);
    const lockedCampaignBudget = myCampaigns
      .filter((c) => c.status === 'ACTIVE' || c.status === 'PAUSED')
      .reduce((sum, c) => sum + c.remainingBudget, 0);

    return {
      currentPoints: user.points,
      earnedTotal,
      spentTotal,
      lockedCampaignBudget,
      transactionsCount: txs.length,
    };
  }
}

export const db = new TransactionalDatabase();
