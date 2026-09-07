import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Key generator respecting user ID header or client IP
function keyGenerator(req: Request): string {
  const userId = req.headers['x-anonymous-user-id'] || req.query.anonymousUserId;
  if (typeof userId === 'string' && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
}

// Global API rate limiter (protect against floods)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1200, // Limit each IP/user to 1200 requests per 15 mins (~80 req/min)
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false,
  keyGenerator,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'تم تجاوز الحد الأقصى المسموح به من الطلبات مؤقتاً. يرجى الانتظار قليلاً والمحاولة مجدداً.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

// Strict limiter for sensitive mutation endpoints (Campaign creation, Task submission, Account verify)
export const sensitiveOpsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 45, // 45 operations per minute per user/IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'طلبات مكثفة على العمليات الحساسة. يرجى الانتظار دقيقة واحدة قبل المحاولة مجدداً.',
      code: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
    });
  },
});
