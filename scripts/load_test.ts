/**
 * Load Testing & Scalability Benchmark Suite
 * Graduated Concurrency Simulation (100 -> 1,000 -> 10,000 requests)
 */

import { db } from '../src/server/db.js';
import { withDistributedLock, checkDistributedRateLimit, cacheGet, cacheSet } from '../src/server/redis/redisClient.js';
import { parseProfileUrl } from '../src/server/accountVerification.js';

interface StageMetrics {
  stageName: string;
  totalRequests: number;
  concurrencyLevel: number;
  durationMs: number;
  requestsPerSecond: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  memoryUsageMb: number;
}

const metrics: StageMetrics[] = [];

async function benchmarkStage(
  stageName: string,
  totalRequests: number,
  batchSize: number
): Promise<StageMetrics> {
  console.log(`\n⚡ Running [${stageName}] - Total: ${totalRequests} reqs, Concurrency: ${batchSize}...`);

  const latencies: number[] = [];
  let errorCount = 0;
  const start = Date.now();

  for (let i = 0; i < totalRequests; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, totalRequests - i) }).map(async (_, idx) => {
      const reqStart = Date.now();
      try {
        const userId = `load_user_${(i + idx) % 500}`;
        // 1. User profile read / create
        db.getOrCreateUser(userId);

        // 2. Cache read/write
        const cacheKey = `user_cache_${userId}`;
        await cacheSet(cacheKey, { active: true }, 60);
        await cacheGet(cacheKey);

        // 3. Profile URL parser
        parseProfileUrl('https://instagram.com/dr_mahdi_official', 'Instagram');

        // 4. Rate limiter check
        await checkDistributedRateLimit(`load_limit_${userId}`, 1000, 60);

        latencies.push(Date.now() - reqStart);
      } catch (err) {
        errorCount++;
        latencies.push(Date.now() - reqStart);
      }
    });

    await Promise.all(batch);
  }

  const durationMs = Date.now() - start;
  latencies.sort((a, b) => a - b);

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const rps = Math.round((totalRequests / (durationMs / 1000)));
  const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  const result: StageMetrics = {
    stageName,
    totalRequests,
    concurrencyLevel: batchSize,
    durationMs,
    requestsPerSecond: rps,
    averageLatencyMs: Math.round(avgLatency * 100) / 100,
    p95LatencyMs: p95Latency,
    errorRate: (errorCount / totalRequests) * 100,
    memoryUsageMb: memMb,
  };

  metrics.push(result);
  console.log(`   ✓ Completed in ${durationMs}ms | RPS: ${rps} | Avg: ${result.averageLatencyMs}ms | P95: ${p95Latency}ms | Errors: ${result.errorRate}% | Memory: ${memMb}MB`);
  return result;
}

async function runLoadTests() {
  console.log('====================================================');
  console.log('📈 STARTING GRADUATED LOAD & STRESS TESTING SUITE');
  console.log('====================================================');

  // Stage 1: 100 Concurrent Requests
  await benchmarkStage('Stage 1: 100 Users Burst', 100, 25);

  // Stage 2: 1,000 Concurrent Requests
  await benchmarkStage('Stage 2: 1,000 Users Scale', 1000, 50);

  // Stage 3: 5,000 High-Concurrency Requests
  await benchmarkStage('Stage 3: 5,000 Users Peak Load', 5000, 100);

  console.log('\n====================================================');
  console.log('📊 LOAD TESTING BENCHMARK SUMMARY TABLE');
  console.log('====================================================');
  console.log('Stage | Requests | Concurrency | Duration | RPS | Avg Latency | P95 | Error Rate | Memory');
  console.log('-----------------------------------------------------------------------------------------');
  for (const m of metrics) {
    console.log(
      `${m.stageName.padEnd(28)} | ${m.totalRequests.toString().padEnd(8)} | ${m.concurrencyLevel.toString().padEnd(11)} | ${(m.durationMs + 'ms').padEnd(8)} | ${m.requestsPerSecond.toString().padEnd(5)} | ${(m.averageLatencyMs + 'ms').padEnd(11)} | ${(m.p95LatencyMs + 'ms').padEnd(4)} | ${(m.errorRate + '%').padEnd(10)} | ${m.memoryUsageMb}MB`
    );
  }
  console.log('====================================================\n');
}

runLoadTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Load testing error:', e);
    process.exit(1);
  });
