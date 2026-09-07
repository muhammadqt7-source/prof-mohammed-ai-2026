import Redis from 'ioredis';
import crypto from 'crypto';

const redisUrl = process.env.REDIS_URL;

export interface RedisHealth {
  isConnected: boolean;
  mode: 'cluster' | 'standalone' | 'in_memory_fallback';
  latencyMs?: number;
  error?: string;
}

let redisClient: Redis | null = null;
let isRedisConnected = false;
let redisError: string | null = null;

// In-memory fallback structures for zero-downtime offline container mode
const memoryStore = new Map<string, { value: string; expiresAt: number }>();
const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      reconnectOnError(err) {
        return err.message.includes('READONLY');
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      redisError = null;
      console.log('[Redis]: Connected to Redis successfully.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      redisError = err.message;
      console.warn('[Redis Client Warning]:', err.message);
    });
  } catch (err: any) {
    redisError = err.message;
    console.warn('[Redis Init Error]:', err.message);
  }
} else {
  console.info('[Redis]: REDIS_URL not configured. Operating in stateless fallback mode.');
}

/**
 * Checks Redis health & ping latency
 */
export async function checkRedisHealth(): Promise<RedisHealth> {
  if (!redisClient) {
    return {
      isConnected: false,
      mode: 'in_memory_fallback',
      error: 'REDIS_URL not configured',
    };
  }

  const start = Date.now();
  try {
    const res = await redisClient.ping();
    const latency = Date.now() - start;
    if (res === 'PONG') {
      return {
        isConnected: true,
        mode: 'standalone',
        latencyMs: latency,
      };
    }
    return {
      isConnected: false,
      mode: 'standalone',
      error: `Unexpected ping response: ${res}`,
    };
  } catch (err: any) {
    return {
      isConnected: false,
      mode: 'standalone',
      error: err.message,
    };
  }
}

/**
 * Distributed Lock: Acquire lock with token and TTL
 */
export async function acquireDistributedLock(
  resource: string,
  ttlMs: number = 10000
): Promise<string | null> {
  const token = crypto.randomUUID();
  const lockKey = `lock:${resource}`;

  if (redisClient && isRedisConnected) {
    try {
      // SET resource token NX PX ttlMs
      const result = await redisClient.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return token;
      }
      return null;
    } catch (err: any) {
      console.warn('[DistributedLock] Redis set failed:', err.message);
    }
  }

  // Fallback to local memory lock if Redis is unavailable
  const now = Date.now();
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.expiresAt > now) {
    return null; // Lock is currently held
  }
  memoryLocks.set(lockKey, { token, expiresAt: now + ttlMs });
  return token;
}

/**
 * Distributed Lock: Release lock atomically using Lua script to verify token
 */
export async function releaseDistributedLock(
  resource: string,
  token: string
): Promise<boolean> {
  const lockKey = `lock:${resource}`;

  if (redisClient && isRedisConnected) {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const result = await redisClient.eval(luaScript, 1, lockKey, token);
      return result === 1;
    } catch (err: any) {
      console.warn('[DistributedLock] Redis eval release failed:', err.message);
    }
  }

  // Memory fallback release
  const existing = memoryLocks.get(lockKey);
  if (existing && existing.token === token) {
    memoryLocks.delete(lockKey);
    return true;
  }
  return false;
}

/**
 * Executes an async function wrapped in a Distributed Lock across all instances
 * with retries and exponential backoff
 */
export async function withDistributedLock<T>(
  resource: string,
  ttlMs: number,
  fn: () => Promise<T>,
  maxRetries: number = 20,
  retryDelayMs: number = 50
): Promise<T> {
  let token: string | null = null;
  let attempts = 0;

  while (attempts < maxRetries) {
    token = await acquireDistributedLock(resource, ttlMs);
    if (token) break;

    attempts++;
    // Exponential backoff with jitter
    const delay = retryDelayMs + Math.floor(Math.random() * 25);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!token) {
    throw new Error(`تعذر الحصول على القفل الموزع [${resource}] بسبب التزامن العالي. يرجى إعادة المحاولة.`);
  }

  try {
    return await fn();
  } finally {
    await releaseDistributedLock(resource, token).catch((e) => {
      console.warn(`[DistributedLock] Failed to release ${resource}:`, e.message);
    });
  }
}

/**
 * Distributed Rate Limiting: Sliding window / Fixed window counter
 */
export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const rateLimitKey = `ratelimit:${key}`;
  const now = Math.floor(Date.now() / 1000);
  const resetTime = now + windowSeconds;

  if (redisClient && isRedisConnected) {
    try {
      const current = await redisClient.incr(rateLimitKey);
      if (current === 1) {
        await redisClient.expire(rateLimitKey, windowSeconds);
      }
      const remaining = Math.max(0, limit - current);
      return {
        allowed: current <= limit,
        remaining,
        resetTime,
      };
    } catch (err: any) {
      console.warn('[RateLimit] Redis error, allowing request:', err.message);
    }
  }

  // Memory fallback rate limiter
  const nowMs = Date.now();
  const entry = memoryStore.get(rateLimitKey);
  let count = 1;
  if (entry && entry.expiresAt > nowMs) {
    count = parseInt(entry.value, 10) + 1;
  }
  memoryStore.set(rateLimitKey, {
    value: count.toString(),
    expiresAt: nowMs + windowSeconds * 1000,
  });

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetTime,
  };
}

/**
 * Distributed Caching: GET
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cacheKey = `cache:${key}`;
  if (redisClient && isRedisConnected) {
    try {
      const data = await redisClient.get(cacheKey);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (err: any) {
      console.warn('[Cache] Redis get error:', err.message);
    }
  }

  // Memory fallback
  const entry = memoryStore.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return JSON.parse(entry.value) as T;
  }
  return null;
}

/**
 * Distributed Caching: SET
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const cacheKey = `cache:${key}`;
  const serialized = JSON.stringify(value);

  if (redisClient && isRedisConnected) {
    try {
      await redisClient.setex(cacheKey, ttlSeconds, serialized);
      return;
    } catch (err: any) {
      console.warn('[Cache] Redis set error:', err.message);
    }
  }

  // Memory fallback
  memoryStore.set(cacheKey, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Distributed Caching: DELETE
 */
export async function cacheDel(key: string): Promise<void> {
  const cacheKey = `cache:${key}`;
  if (redisClient && isRedisConnected) {
    try {
      await redisClient.del(cacheKey);
    } catch (err: any) {
      console.warn('[Cache] Redis del error:', err.message);
    }
  }
  memoryStore.delete(cacheKey);
}

/**
 * Distributed Caching: Invalidate Pattern
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const fullPattern = `cache:${pattern}*`;
  if (redisClient && isRedisConnected) {
    try {
      const keys = await redisClient.keys(fullPattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err: any) {
      console.warn('[Cache] Redis keys invalidation error:', err.message);
    }
  }

  // Memory cleanup
  for (const k of memoryStore.keys()) {
    if (k.startsWith(`cache:${pattern}`)) {
      memoryStore.delete(k);
    }
  }
}

/**
 * Idempotency Key check: returns true if key was set (first time), false if already exists
 */
export async function checkAndSetIdempotency(
  key: string,
  ttlSeconds: number = 3600
): Promise<boolean> {
  const idempotencyKey = `idempotency:${key}`;
  if (redisClient && isRedisConnected) {
    try {
      const res = await redisClient.set(idempotencyKey, '1', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (err: any) {
      console.warn('[Idempotency] Redis set error:', err.message);
    }
  }

  const now = Date.now();
  const existing = memoryStore.get(idempotencyKey);
  if (existing && existing.expiresAt > now) {
    return false;
  }
  memoryStore.set(idempotencyKey, { value: '1', expiresAt: now + ttlSeconds * 1000 });
  return true;
}

export { redisClient };
