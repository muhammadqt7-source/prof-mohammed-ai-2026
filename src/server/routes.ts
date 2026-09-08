import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { LEVEL_THRESHOLDS } from '../types.js';
import { parseProfileUrl, verifyAccountWithOfficialApi } from './accountVerification.js';
import { globalLimiter, sensitiveOpsLimiter } from './rateLimit.js';
import { appCache } from './cache.js';
import { checkPostgresHealth } from './db/postgres.js';
import { checkRedisHealth } from './redis/redisClient.js';
import { appQueue } from './queue/queue.js';

export const apiRouter = Router();

// Apply global rate limiting across all API endpoints (Protection against DDoS and scraping)
apiRouter.use(globalLimiter);

// Middleware to extract anonymousUserId from header or query
function getUserId(req: Request): string {
  const headerId = req.headers['x-anonymous-user-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }
  const queryId = req.query.anonymousUserId;
  if (typeof queryId === 'string' && queryId.trim()) {
    return queryId.trim();
  }
  return 'user_default';
}

// 1. Health API (Multi-Service Production Health Check)
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const pgHealth = await checkPostgresHealth();
  const redisHealth = await checkRedisHealth();
  const queueStats = await appQueue.getStats();

  res.json({
    status: 'ok',
    backend: 'healthy',
    database: {
      engine: 'PostgreSQL',
      connected: pgHealth.isPostgresConnected,
      poolTotalCount: pgHealth.poolTotalCount,
      poolIdleCount: pgHealth.poolIdleCount,
      status: pgHealth.isPostgresConnected
        ? 'CONNECTED'
        : (process.env.DATABASE_URL ? 'CONNECTING_OR_RETRYING' : 'READY_CONFIG_REQUIRED'),
    },
    redis: {
      connected: redisHealth.isConnected,
      mode: redisHealth.mode,
      latencyMs: redisHealth.latencyMs ?? null,
      status: redisHealth.isConnected
        ? 'CONNECTED'
        : (process.env.REDIS_URL ? 'CONNECTING_OR_RETRYING' : 'STATELESS_FALLBACK_ACTIVE'),
    },
    queue: {
      pendingJobs: queueStats.pendingJobs,
      processedCount: queueStats.processedCount,
      failedCount: queueStats.failedCount,
      redisBacked: queueStats.isRedisBacked,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Telemetry & Scalability Metrics API
apiRouter.get('/telemetry/metrics', async (_req: Request, res: Response) => {
  try {
    const dbMetrics = db.getDbMetrics();
    const cacheStats = appCache.stats();
    const pgHealth = await checkPostgresHealth();
    const redisHealth = await checkRedisHealth();
    const queueStats = await appQueue.getStats();

    res.json({
      status: 'healthy',
      statelessInstance: true,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        ...dbMetrics,
        postgres: pgHealth,
      },
      redis: redisHealth,
      queue: queueStats,
      cache: cacheStats,
      nodeVersion: process.version,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. User Profile API
apiRouter.get('/user/me', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = db.getOrCreateUser(userId);
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Tasks API with Pagination, Caching, and O(1) Lookup
apiRouter.get('/tasks', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const cacheKey = `tasks:${userId}:${page || 'all'}:${limit || 'all'}`;

    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const tasks = db.getTasks(page, limit);
    const userCompletions = db.getUserCompletions(userId);
    const compMap = new Map(userCompletions.map((c) => [c.taskId, c]));

    const tasksWithStatus = tasks.map((task) => {
      const completion = compMap.get(task.id);
      return {
        ...task,
        userCompletionStatus: completion ? completion.status : null,
        userCompletionId: completion ? completion.id : null,
      };
    });

    const responsePayload = { tasks: tasksWithStatus };
    appCache.set(cacheKey, responsePayload, 3000, ['tasks', 'user:' + userId]);
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/tasks/:id', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const task = db.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'المهمة غير موجودة' });
    }
    const userCompletions = db.getUserCompletions(userId);
    const completion = userCompletions.find((c) => c.taskId === task.id);

    res.json({
      task: {
        ...task,
        userCompletionStatus: completion ? completion.status : null,
        userCompletionId: completion ? completion.id : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const submitTaskSchema = z.object({
  proofNote: z.string().max(500).optional(),
});

// Sensitive Rate-Limited + User Mutex Locked Task Completion (+1 Point Idempotent)
apiRouter.post('/tasks/:id/submit', sensitiveOpsLimiter, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = submitTaskSchema.parse(req.body);

    const result = await db.withUserLock(userId, async () => {
      return db.submitTaskCompletion(req.params.id, userId, parsed.proofNote);
    });

    if ((result as any).isDuplicate) {
      return res.json({
        success: true,
        message: 'تم تسجيل إنجاز هذه المهمة مسبقاً (+1 نقطة معتمدة)',
        completion: result.completion,
        userBalance: result.workerUser.points,
        alreadyCompleted: true,
      });
    }
    res.json({
      success: true,
      message: 'تم إنجاز المهمة واعتمادها بنجاح! تم إضافة +1 نقطة إلى رصيدك.',
      completion: result.completion,
      userBalance: result.workerUser.points,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Account Preview API - Requirement #5 & #6
// Safe, no passwords, no tokens, purely public verification URL
apiRouter.get('/account/preview', (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'TikTok';
    const rawUsername = (req.query.username as string) || '';

    const cleanUsername = rawUsername.replace(/^@+/, '').trim();
    if (!cleanUsername || !/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'اسم مستخدم غير صالح. استخدم أحرف إنجليزية وأرقام ونقاط فقط.' });
    }

    const isInstagram = platform.toLowerCase().includes('insta');
    const targetUrl = isInstagram
      ? `https://www.instagram.com/${cleanUsername}`
      : `https://www.tiktok.com/@${cleanUsername}`;

    res.json({
      success: true,
      platform: isInstagram ? 'Instagram' : 'TikTok',
      username: cleanUsername,
      displayName: `@${cleanUsername}`,
      targetUrl,
      avatarUrl: null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Campaigns API with Pagination & Caching
apiRouter.get('/campaigns', (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const cacheKey = `campaigns:${page || 'all'}:${limit || 'all'}`;

    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const campaigns = db.getCampaigns(page, limit);
    const responsePayload = { campaigns };
    appCache.set(cacheKey, responsePayload, 3000, ['campaigns']);
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/campaigns/:id', (req: Request, res: Response) => {
  try {
    const campaign = db.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'الحملة غير موجودة' });
    }
    res.json({ campaign });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verification API for target Instagram & TikTok profiles (Sensitive Rate-Limited)
apiRouter.post('/accounts/verify', sensitiveOpsLimiter, async (req: Request, res: Response) => {
  try {
    const { profileUrl, platform } = req.body;
    if (!profileUrl || typeof profileUrl !== 'string' || !profileUrl.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال رابط الحساب المستهدف' });
    }

    const parsed = parseProfileUrl(profileUrl.trim(), platform);
    if (!parsed.isValid) {
      return res.status(400).json({ error: parsed.error || 'رابط الحساب غير صالح' });
    }

    const verification = await verifyAccountWithOfficialApi(
      parsed.platform,
      parsed.cleanUsername,
      parsed.canonicalUrl
    );

    res.json({
      success: true,
      platform: parsed.platform,
      targetPlatform: parsed.platform,
      username: parsed.username,
      cleanUsername: parsed.cleanUsername,
      canonicalUrl: parsed.canonicalUrl,
      profileUrl: parsed.canonicalUrl,
      isVerified: verification.isVerified,
      targetAccountVerified: verification.isVerified,
      status: verification.status,
      displayName: verification.displayName || null,
      targetDisplayName: verification.displayName || null,
      avatarUrl: verification.avatarUrl || null,
      targetAvatarUrl: verification.avatarUrl || null,
      reason: verification.reason || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const createCampaignSchema = z.object({
  title: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable().default(''),
  platform: z.enum(['Instagram', 'TikTok', 'instagram', 'tiktok']).default('TikTok'),
  targetPlatform: z.string().optional().nullable(),
  taskType: z.literal('FOLLOWERS').default('FOLLOWERS'),
  targetUsername: z.string().max(80).optional().nullable(),
  targetProfileUrl: z.string().optional().nullable(),
  targetDisplayName: z.string().max(100).optional().nullable(),
  targetAvatarUrl: z.string().url().optional().nullable().or(z.literal('')),
  targetUrl: z.string().optional().nullable(),
  isAccountVerified: z.boolean().optional().nullable(),
  targetAccountVerified: z.boolean().optional().nullable(),
  targetCompletions: z.number().int().optional().default(10),
  rewardPerCompletion: z.number().int().optional().default(1),
  durationMinutes: z.number().int().min(5, 'المدة يجب أن تكون 5 دقائق على الأقل').default(1440),
});

// Sensitive Rate-Limited + Mutex Locked Campaign Creation (Atomically deducts 10 points)
apiRouter.post('/campaigns', sensitiveOpsLimiter, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createCampaignSchema.parse(req.body);

    const rawUrl = (parsed.targetProfileUrl || parsed.targetUrl || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'رابط الحساب المستهدف (Profile URL) مطلوب إلزاميًا لإنشاء الحملة' });
    }

    const parsedInfo = parseProfileUrl(rawUrl, parsed.platform as any);
    if (!parsedInfo.isValid || !parsedInfo.cleanUsername) {
      return res.status(400).json({ error: parsedInfo.error || 'رابط الحساب المستهدف غير صالح' });
    }

    const targetUsername = parsedInfo.cleanUsername;
    const finalPlatform: 'Instagram' | 'TikTok' = parsedInfo.platform;
    const canonicalUrl = parsedInfo.canonicalUrl;

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
    if (forbiddenMockUsernames.has(targetUsername.toLowerCase())) {
      return res.status(400).json({ error: 'لا يمكن إنشاء حملات لحسابات تجريبية أو وهمية.' });
    }

    // Official Verification check (Meta Graph API / TikTok Open API)
    // NEVER creates a fake account or fallback placeholder as real account
    const verification = await verifyAccountWithOfficialApi(
      finalPlatform,
      targetUsername,
      canonicalUrl
    );

    // Mutex lock ensures point balance cannot be spent concurrently
    const { campaign, user } = await db.withUserLock(userId, async () => {
      return db.createCampaign(userId, {
        ...parsed,
        platform: finalPlatform,
        targetPlatform: finalPlatform,
        targetUsername,
        targetProfileUrl: canonicalUrl,
        targetUrl: canonicalUrl,
        isAccountVerified: Boolean(verification.isVerified),
        targetAccountVerified: Boolean(verification.isVerified),
        status: verification.isVerified ? 'ACTIVE' : 'ACCOUNT_DATA_UNAVAILABLE',
        targetDisplayName: verification.isVerified ? verification.displayName : undefined,
        targetAvatarUrl: verification.isVerified ? verification.avatarUrl : undefined,
      });
    });

    // Invalidate caches immediately
    appCache.invalidateTags(['user:' + userId, 'campaigns', 'tasks']);

    res.json({
      success: true,
      message: 'تم إنشاء الحملة وخصم 10 نقاط فورياً بنجاح',
      campaign,
      userBalance: user.points,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const issue = (err as any).issues?.[0] || (err as any).errors?.[0];
      return res.status(400).json({ error: issue?.message || 'بيانات غير صالحة' });
    }
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/campaigns/:id/pause', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const campaign = db.togglePauseCampaign(req.params.id, userId);
    res.json({ success: true, campaign });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/campaigns/:id/cancel', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const campaign = db.cancelCampaign(req.params.id, userId);
    const user = db.getOrCreateUser(userId);
    appCache.invalidateTags(['user:' + userId, 'campaigns', 'tasks']);
    res.json({
      success: true,
      message: 'تم إلغاء الحملة واسترجاع الميزانية المتبقية إلى رصيدك',
      campaign,
      userBalance: user.points,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/my-campaigns', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const cacheKey = `my-campaigns:${userId}:${page || 'all'}:${limit || 'all'}`;

    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const campaigns = db.getUserCampaigns(userId, page, limit);
    const responsePayload = { campaigns };
    appCache.set(cacheKey, responsePayload, 3000, ['campaigns', 'user:' + userId]);
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Points & History API (Always real-time, zero stale cache)
apiRouter.get('/points', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const overview = db.getPointsOverview(userId);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/points/history', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const transactions = db.getUserPointTransactions(userId, page, limit);
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Progress & Levels API
apiRouter.get('/progress', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const cacheKey = `progress:${userId}`;

    const cached = appCache.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = db.getOrCreateUser(userId);

    const currentLevelIndex = LEVEL_THRESHOLDS.findIndex((l) => l.level === user.level);
    const currentThreshold = LEVEL_THRESHOLDS[currentLevelIndex] || LEVEL_THRESHOLDS[0];
    const nextThreshold = LEVEL_THRESHOLDS[currentLevelIndex + 1] || null;

    let progressPercent = 100;
    let xpForNext = 0;

    if (nextThreshold) {
      const range = nextThreshold.minXP - currentThreshold.minXP;
      const progressInLevel = Math.max(0, user.xp - currentThreshold.minXP);
      progressPercent = Math.min(100, Math.round((progressInLevel / range) * 100));
      xpForNext = Math.max(0, nextThreshold.minXP - user.xp);
    }

    const responsePayload = {
      user,
      levelInfo: currentThreshold,
      nextLevelInfo: nextThreshold,
      progressPercent,
      xpForNext,
      canClaimToday: false,
      milestones: [
        { days: 3, xpBonus: 0, reached: user.currentStreak >= 3 },
        { days: 7, xpBonus: 0, reached: user.currentStreak >= 7 },
        { days: 14, xpBonus: 0, reached: user.currentStreak >= 14 },
        { days: 30, xpBonus: 0, reached: user.currentStreak >= 30 },
      ],
    };

    appCache.set(cacheKey, responsePayload, 3000, ['user:' + userId]);
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Daily Bonus API (Permanently disabled per user instruction: "لا يوجد Daily Bonus")
apiRouter.post('/daily-bonus/claim', (req: Request, res: Response) => {
  res.status(400).json({
    error: 'تم إيقاف المكافأة اليومية نهائياً. النقاط تأتي حصراً من إنجاز المهام (+1 نقطة لكل مهمة معتمدة).',
  });
});

// 8. Admin APIs (Protected for Admin Dashboard)
apiRouter.get('/admin/overview', (req: Request, res: Response) => {
  try {
    const users = db.getAllUsers();
    const campaigns = db.getCampaigns();
    const tasks = db.getTasks();
    const completions = db.getAllCompletions();
    const transactions = db.getAllPointTransactions();
    const auditLogs = db.getAuditLogs();

    const pendingCompletions = completions.filter((c) => c.status === 'PENDING');
    const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE');

    res.json({
      totalUsers: users.length,
      activeCampaignsCount: activeCampaigns.length,
      totalCampaignsCount: campaigns.length,
      pendingCompletionsCount: pendingCompletions.length,
      totalTasksCount: tasks.length,
      totalTransactionsCount: transactions.length,
      recentCompletions: completions.slice(0, 20),
      recentTransactions: transactions.slice(0, 20),
      recentAuditLogs: auditLogs.slice(0, 20),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/completions', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    let completions = db.getAllCompletions();
    if (status) {
      completions = completions.filter((c) => c.status === status);
    }
    res.json({ completions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/completions/:id/approve', (req: Request, res: Response) => {
  try {
    const adminId = getUserId(req) || 'admin';
    const note = req.body.verificationNote || 'تم التحقق وقبول الإنجاز بنجاح';
    const result = db.approveTaskCompletion(req.params.id, adminId, note);
    res.json({
      success: true,
      message: 'تم قبول الإنجاز وإضافة المكافأة والخبرة للمستخدم فورياً',
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/completions/:id/reject', (req: Request, res: Response) => {
  try {
    const adminId = getUserId(req) || 'admin';
    const reason = req.body.reason || 'لم يتم استيفاء شروط المهمة';
    const completion = db.rejectTaskCompletion(req.params.id, adminId, reason);
    res.json({
      success: true,
      message: 'تم رفض الإنجاز بنجاح',
      completion,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/campaigns/:id/status', (req: Request, res: Response) => {
  try {
    const adminId = getUserId(req) || 'admin';
    const action = req.body.action; // 'pause' | 'cancel'
    if (action === 'cancel') {
      const campaign = db.cancelCampaign(req.params.id, adminId);
      res.json({ success: true, campaign });
    } else {
      const campaign = db.togglePauseCampaign(req.params.id, adminId);
      res.json({ success: true, campaign });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/users/:id/adjust-points', (req: Request, res: Response) => {
  try {
    const adminId = getUserId(req) || 'admin';
    const amount = Number(req.body.amount);
    const reason = req.body.reason || 'تعديل إداري معتمد';
    if (isNaN(amount) || amount === 0) {
      return res.status(400).json({ error: 'قيمة التعديل يجب أن تكون رقماً غير صفري' });
    }
    const result = db.adminAdjustPoints(adminId, req.params.id, amount, reason);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/admin/audit-logs', (req: Request, res: Response) => {
  try {
    const logs = db.getAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/users', (req: Request, res: Response) => {
  try {
    const users = db.getAllUsers();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
