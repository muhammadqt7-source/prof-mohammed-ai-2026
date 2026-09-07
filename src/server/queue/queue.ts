import { redisClient } from '../redis/redisClient.js';
import crypto from 'crypto';

export type JobType =
  | 'ACCOUNT_METADATA_REFRESH'
  | 'NOTIFICATION_DISPATCH'
  | 'CACHE_INVALIDATION'
  | 'AUDIT_LOG_PROCESSING'
  | 'CAMPAIGN_EXPIRY_CHECK';

export interface QueueJob<T = any> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxRetries: number;
  createdAt: number;
  error?: string;
}

export interface QueueStats {
  pendingJobs: number;
  processedCount: number;
  failedCount: number;
  activeWorkers: number;
  isRedisBacked: boolean;
}

type JobHandler<T = any> = (job: QueueJob<T>) => Promise<void>;

class DistributedQueue {
  private handlers = new Map<JobType, JobHandler>();
  private inMemoryQueue: QueueJob[] = [];
  private isProcessing = false;
  private processedCount = 0;
  private failedCount = 0;
  private workerInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startWorker();
  }

  // Register a handler for a job type
  public registerHandler<T = any>(type: JobType, handler: JobHandler<T>) {
    this.handlers.set(type, handler);
  }

  // Enqueue a new background job
  public async enqueue<T = any>(
    type: JobType,
    payload: T,
    options: { maxRetries?: number } = {}
  ): Promise<string> {
    const job: QueueJob<T> = {
      id: `job_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`,
      type,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: Date.now(),
    };

    const isRedisReady = redisClient && redisClient.status === 'ready';

    if (isRedisReady) {
      try {
        await redisClient.lpush('queue:jobs', JSON.stringify(job));
        return job.id;
      } catch (err: any) {
        console.warn('[Queue] Redis enqueue error, falling back to in-memory:', err.message);
      }
    }

    // In-memory queue fallback
    this.inMemoryQueue.push(job);
    return job.id;
  }

  // Start background queue processing worker loop
  private startWorker() {
    if (this.workerInterval) return;

    this.workerInterval = setInterval(async () => {
      if (this.isProcessing) return;
      await this.processNextJobs();
    }, 500);
  }

  private async processNextJobs() {
    this.isProcessing = true;
    try {
      let job: QueueJob | null = null;
      const isRedisReady = redisClient && redisClient.status === 'ready';

      if (isRedisReady) {
        try {
          const raw = await redisClient.rpop('queue:jobs');
          if (raw) {
            job = JSON.parse(raw);
          }
        } catch (err: any) {
          console.warn('[Queue] Redis dequeue error:', err.message);
        }
      }

      if (!job && this.inMemoryQueue.length > 0) {
        job = this.inMemoryQueue.shift() || null;
      }

      if (!job) {
        this.isProcessing = false;
        return;
      }

      const handler = this.handlers.get(job.type);
      if (!handler) {
        console.warn(`[Queue] No handler registered for job type: ${job.type}`);
        this.failedCount++;
        this.isProcessing = false;
        return;
      }

      try {
        job.attempts++;
        await handler(job);
        this.processedCount++;
      } catch (err: any) {
        console.error(`[Queue] Job ${job.id} (${job.type}) failed:`, err.message);
        job.error = err.message;

        if (job.attempts < job.maxRetries) {
          // Re-enqueue with retry
          if (isRedisReady) {
            await redisClient.lpush('queue:jobs', JSON.stringify(job));
          } else {
            this.inMemoryQueue.push(job);
          }
        } else {
          this.failedCount++;
          console.error(`[Queue] Job ${job.id} permanently failed after ${job.attempts} attempts.`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Return Queue metrics
  public async getStats(): Promise<QueueStats> {
    const isRedisReady = redisClient && redisClient.status === 'ready';
    let redisPending = 0;
    if (isRedisReady) {
      try {
        redisPending = await redisClient.llen('queue:jobs');
      } catch {
        redisPending = 0;
      }
    }

    return {
      pendingJobs: redisPending + this.inMemoryQueue.length,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      activeWorkers: 1,
      isRedisBacked: Boolean(isRedisReady),
    };
  }
}

export const appQueue = new DistributedQueue();
