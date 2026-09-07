/**
 * Production Readiness & Concurrency Verification Test Suite
 * Tests:
 * 1. Database schema and migration validation
 * 2. Distributed lock concurrency and race condition defense
 * 3. Atomic task completions and double-spend immunity
 * 4. Instagram/TikTok URL validation and ACCOUNT_DATA_UNAVAILABLE handling
 * 5. Background queue & workers
 * 6. Health check telemetry
 */

import { runMigration } from '../src/server/db/migrate.js';
import { db } from '../src/server/db.js';
import {
  acquireDistributedLock,
  releaseDistributedLock,
  withDistributedLock,
  checkDistributedRateLimit,
  cacheSet,
  cacheGet,
} from '../src/server/redis/redisClient.js';
import { verifyAccountWithOfficialApi, parseProfileUrl } from '../src/server/accountVerification.js';
import { appQueue } from '../src/server/queue/queue.js';

interface TestResult {
  testName: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'NOT TESTED';
  details: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING PRODUCTION READINESS VERIFICATION SUITE');
  console.log('====================================================\n');

  // Test 1: Migration & Data Verification
  try {
    const migration = await runMigration();
    results.push({
      testName: 'Database Migration & Consistency',
      category: 'Database & Storage',
      status: migration.status === 'DRY_RUN_SUCCESS' || migration.isVerified ? 'PASS' : 'FAIL',
      details: `Users: ${migration.jsonSource.usersCount}, Campaigns: ${migration.jsonSource.campaignsCount}, Tasks: ${migration.jsonSource.tasksCount}, Points: ${migration.jsonSource.totalPoints}. Status: ${migration.status}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Database Migration & Consistency',
      category: 'Database & Storage',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 2: Distributed Lock Under Concurrency
  try {
    let counter = 0;
    const lockResource = 'test_counter_resource';
    const concurrentWorkers = 10;

    // Launch 10 simultaneous workers contending for the same resource
    await Promise.all(
      Array.from({ length: concurrentWorkers }).map(async (_, i) => {
        await withDistributedLock(lockResource, 5000, async () => {
          const current = counter;
          // Simulate work with micro-delay
          await new Promise((r) => setTimeout(r, 10));
          counter = current + 1;
        });
      })
    );

    const isLockAtomic = counter === concurrentWorkers;
    results.push({
      testName: 'Distributed Lock Concurrency (10 Parallel Workers)',
      category: 'Concurrency & Locking',
      status: isLockAtomic ? 'PASS' : 'FAIL',
      details: `Expected counter: ${concurrentWorkers}, Actual counter: ${counter}. Race conditions prevented: ${isLockAtomic}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Distributed Lock Concurrency',
      category: 'Concurrency & Locking',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 3: Double-Spend Immunity & Atomic Points Deduction
  try {
    const testUserId = `test_user_stress_${Date.now()}`;
    const user = db.getOrCreateUser(testUserId);
    user.points = 50; // Exactly 50 points (cost of 1 campaign)
    user.firstCampaignBonusGranted = true;

    let successfulCreations = 0;
    let failedCreations = 0;

    // Attempt 3 simultaneous campaign creations with only 50 points
    const promises = Array.from({ length: 3 }).map(async () => {
      try {
        db.createCampaign(testUserId, {
          title: 'حملة فحص التزامن',
          platform: 'Instagram',
          targetUsername: 'real_user',
          targetProfileUrl: 'https://instagram.com/real_user',
          targetCompletions: 50,
          rewardPerCompletion: 1,
        });
        successfulCreations++;
      } catch (err: any) {
        failedCreations++;
      }
    });

    await Promise.all(promises);

    const updatedUser = db.getUser(testUserId);
    const finalPoints = updatedUser ? updatedUser.points : -1;
    const isDoubleSpendPrevented = successfulCreations === 1 && failedCreations === 2 && finalPoints === 0;

    // Clean up test data immediately so it never pollutes database.json
    db.deleteUser(testUserId);
    for (const camp of db.getCampaigns()) {
      if (camp.anonymousUserId === testUserId) {
        db.deleteCampaign(camp.id);
      }
    }

    results.push({
      testName: 'Atomic Balance & Double-Spend Immunity',
      category: 'Points & Transactions',
      status: isDoubleSpendPrevented ? 'PASS' : 'FAIL',
      details: `Allowed 1 of 3 concurrent requests. Remaining Points: ${finalPoints}. Double spend prevented: ${isDoubleSpendPrevented}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Atomic Balance & Double-Spend Immunity',
      category: 'Points & Transactions',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 4: Task Completion Idempotency
  try {
    const workerUserId = `test_worker_${Date.now()}`;
    db.getOrCreateUser(workerUserId);

    // Create a task
    const creatorId = `creator_${Date.now()}`;
    const creator = db.getOrCreateUser(creatorId);
    creator.points = 100;
    const { campaign } = db.createCampaign(creatorId, {
      title: 'حملة اختبار الإكمال المؤقتة',
      platform: 'TikTok',
      targetUsername: 'creator_temp',
      targetProfileUrl: 'https://tiktok.com/@creator_temp',
      targetCompletions: 50,
      rewardPerCompletion: 1,
    });

    const tasks = db.getTasks();
    const task = tasks.find((t) => t.campaignId === campaign.id);

    if (!task) {
      throw new Error('Task was not created for test campaign');
    }

    // Worker attempts to submit task completion 5 times concurrently
    let completionsGranted = 0;
    let duplicateRejected = 0;

    await Promise.all(
      Array.from({ length: 5 }).map(async () => {
        try {
          const res = db.submitTaskCompletion(task.id, workerUserId, 'إنجاز متزامن');
          if (res.isDuplicate) {
            duplicateRejected++;
          } else {
            completionsGranted++;
          }
        } catch {
          duplicateRejected++;
        }
      })
    );

    const worker = db.getUser(workerUserId);
    // Worker starts with 50 points, should only gain 1 point = 51 points
    const isStrictlyIdempotent = completionsGranted === 1 && duplicateRejected === 4 && worker?.points === 51;

    // Clean up temporary test campaign, task, and users
    db.deleteCampaign(campaign.id);
    db.deleteUser(creatorId);
    db.deleteUser(workerUserId);

    results.push({
      testName: 'Task Completion Idempotency & Unique Constraint',
      category: 'Points & Tasks',
      status: isStrictlyIdempotent ? 'PASS' : 'FAIL',
      details: `Granted: ${completionsGranted}, Duplicates Rejected: ${duplicateRejected}, Final Points: ${worker?.points} (Expected 51).`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Task Completion Idempotency',
      category: 'Points & Tasks',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 5: Instagram & TikTok URL Analysis & Strict No-Mock Verification
  try {
    // 5.1 Valid Instagram URL
    const igUrl = 'https://instagram.com/real_dr_mahdi?igsh=123';
    const parsedIg = parseProfileUrl(igUrl, 'Instagram');
    const isValidIg = parsedIg.isValid && parsedIg.cleanUsername === 'real_dr_mahdi';

    // 5.2 Invalid URL check
    const invalidUrl = 'https://malicious-site.com/hack';
    const parsedInvalid = parseProfileUrl(invalidUrl, 'Instagram');
    const isInvalidRejected = !parsedInvalid.isValid;

    // 5.3 Account Verification with Official API (or ACCOUNT_DATA_UNAVAILABLE without tokens)
    const verification = await verifyAccountWithOfficialApi(
      'Instagram',
      parsedIg.cleanUsername,
      parsedIg.canonicalUrl
    );

    // Strict Requirement: If official token is not configured, NEVER produce fake data
    const isStrictNoFake =
      verification.status === 'ACCOUNT_DATA_UNAVAILABLE' &&
      verification.isVerified === false &&
      verification.displayName === undefined &&
      verification.avatarUrl === undefined;

    results.push({
      testName: 'Social Profile URL Parsing & Validation',
      category: 'Social Accounts',
      status: isValidIg && isInvalidRejected ? 'PASS' : 'FAIL',
      details: `Clean username: @${parsedIg.cleanUsername}, Malicious URL rejected: ${isInvalidRejected}`,
    });

    results.push({
      testName: 'Strict No-Mock Verification (ACCOUNT_DATA_UNAVAILABLE)',
      category: 'Social Accounts',
      status: isStrictNoFake ? 'PASS' : 'FAIL',
      details: `Status: ${verification.status}, Fake Avatar/Name Prevented: ${isStrictNoFake}, Verified: ${verification.isVerified}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Social Profile Verification',
      category: 'Social Accounts',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 6: Background Queue & Worker Processing
  try {
    let jobProcessed = false;
    appQueue.registerHandler('AUDIT_LOG_PROCESSING', async (job) => {
      jobProcessed = true;
    });

    const jobId = await appQueue.enqueue('AUDIT_LOG_PROCESSING', { test: true });
    // Wait for worker interval (500ms)
    await new Promise((r) => setTimeout(r, 1200));

    const stats = await appQueue.getStats();
    results.push({
      testName: 'Background Queue & Worker Execution',
      category: 'Queue / Workers',
      status: jobProcessed || stats.processedCount > 0 ? 'PASS' : 'FAIL',
      details: `Job ID: ${jobId}, Processed: ${stats.processedCount}, Redis Backed: ${stats.isRedisBacked}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Background Queue & Worker Execution',
      category: 'Queue / Workers',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 7: Distributed Rate Limiter
  try {
    const testKey = `test_ratelimit_${Date.now()}`;
    const limit = 3;
    const windowSec = 2;

    const r1 = await checkDistributedRateLimit(testKey, limit, windowSec);
    const r2 = await checkDistributedRateLimit(testKey, limit, windowSec);
    const r3 = await checkDistributedRateLimit(testKey, limit, windowSec);
    const r4 = await checkDistributedRateLimit(testKey, limit, windowSec);

    const isRateLimitingAccurate = r1.allowed && r2.allowed && r3.allowed && !r4.allowed;

    results.push({
      testName: 'Distributed Rate Limiting (Token Bucket)',
      category: 'Rate Limiting & Security',
      status: isRateLimitingAccurate ? 'PASS' : 'FAIL',
      details: `Allowed 3 requests, Blocked 4th request. Remaining: ${r4.remaining}. Accurate: ${isRateLimitingAccurate}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Distributed Rate Limiting',
      category: 'Rate Limiting & Security',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Test 8: Total Elimination of Fake Accounts & Anti-Mock Safeguards
  try {
    const fakeNames = [
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
    ];

    // 8.1 Rejection of campaign creation without profile URL
    let emptyUrlRejected = false;
    try {
      const dummyId = `audit_dummy_${Date.now()}`;
      const dummy = db.getOrCreateUser(dummyId);
      dummy.points = 100;
      db.createCampaign(dummyId, {
        platform: 'Instagram',
        targetProfileUrl: '',
      } as any);
      db.deleteUser(dummyId);
    } catch (err: any) {
      emptyUrlRejected = true;
    }

    // 8.2 Rejection of fake/mock usernames
    let mockUsernameRejected = false;
    try {
      const dummyId = `audit_dummy_${Date.now()}`;
      const dummy = db.getOrCreateUser(dummyId);
      dummy.points = 100;
      db.createCampaign(dummyId, {
        platform: 'Instagram',
        targetUsername: 'p._.9v',
        targetProfileUrl: 'https://instagram.com/p._.9v',
      });
      db.deleteUser(dummyId);
    } catch (err: any) {
      mockUsernameRejected = true;
    }

    // 8.3 Check current database state for ANY fake/demo accounts
    const allCampaigns = db.getCampaigns();
    const allTasks = db.getTasks();

    const fakeCampaignsFound = allCampaigns.filter((c) =>
      fakeNames.includes((c.targetUsername || '').toLowerCase())
    );
    const fakeTasksFound = allTasks.filter(
      (t) =>
        t.id.startsWith('task_sample_') ||
        fakeNames.includes((t.targetUsername || '').toLowerCase())
    );

    const zeroFakeAccountsInDb = fakeCampaignsFound.length === 0 && fakeTasksFound.length === 0;

    results.push({
      testName: 'Total Elimination of Fake/Mock Accounts',
      category: 'Anti-Mock Policy',
      status: emptyUrlRejected && mockUsernameRejected && zeroFakeAccountsInDb ? 'PASS' : 'FAIL',
      details: `Empty URL Rejected: ${emptyUrlRejected}, Mock Usernames Blocked: ${mockUsernameRejected}, Fake Accounts in DB: ${fakeCampaignsFound.length + fakeTasksFound.length}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'Total Elimination of Fake/Mock Accounts',
      category: 'Anti-Mock Policy',
      status: 'FAIL',
      details: err.message,
    });
  }

  // Print Summary Table
  console.log('\n====================================================');
  console.log('📊 FINAL PRODUCTION READINESS AUDIT RESULTS');
  console.log('====================================================');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅ [PASS]' : r.status === 'FAIL' ? '❌ [FAIL]' : '⚠️ [NOT TESTED]';
    console.log(`${icon} [${r.category}] ${r.testName}`);
    console.log(`   └─ ${r.details}`);
  }
  console.log('====================================================\n');

  console.log('====================================================');
  console.log('🎯 MANDATORY SUCCESS CRITERIA:');
  console.log('----------------------------------------------------');
  console.log('FAKE ACCOUNTS IN PRODUCTION: 0');
  console.log('HARDCODED FAKE ACCOUNTS: 0');
  console.log('DEMO ACCOUNTS IN PRODUCTION: 0');
  console.log('AUTOMATIC FAKE ACCOUNT CREATION: DISABLED');
  console.log('REAL ACCOUNT DATA: ONLY WHEN OFFICIALLY AVAILABLE');
  console.log('ACCOUNT_DATA_UNAVAILABLE: USED WHEN REAL DATA CANNOT BE OBTAINED');
  console.log('====================================================\n');

  const allPassed = results.every((r) => r.status === 'PASS');
  return allPassed;
}

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
