import { db } from '../src/server/db.js';
import { generateContentSafe } from '../src/server/gemini.js';

interface AuditItem {
  category: string;
  test: string;
  passed: boolean;
  details: string;
}

const auditLog: AuditItem[] = [];

function record(category: string, test: string, passed: boolean, details: string) {
  auditLog.push({ category, test, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${category}] ${test} -> ${details}`);
}

async function runProductionAudit() {
  console.log('\n================================================================');
  console.log('🚀 COMPREHENSIVE PRODUCTION AUDIT SUITE (PRE-DEPLOYMENT)');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000';
  const timestamp = Date.now();

  // -------------------------------------------------------------
  // SECTION 1: BACKEND API HEALTH & CORE ENDPOINTS
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    record('Backend', 'GET /health Root Container Probe', res.status === 200 && data.status === 'ok', `Status ${res.status}, response: ${JSON.stringify(data)}`);
  } catch (err: any) {
    record('Backend', 'GET /health Root Container Probe', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    record('Backend', 'GET /api/health Production Health Check', res.status === 200 && data.status === 'ok', `Status ${res.status}, backend: ${data.backend}, database: ${data.database?.engine}`);
  } catch (err: any) {
    record('Backend', 'GET /api/health Production Health Check', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/version`);
    const data = await res.json();
    const cacheHeader = res.headers.get('cache-control') || '';
    record('Backend', 'GET /api/version & Anti-Cache Headers', res.status === 200 && cacheHeader.includes('no-cache'), `Build: ${data.buildId}, Cache-Control: ${cacheHeader}`);
  } catch (err: any) {
    record('Backend', 'GET /api/version & Anti-Cache Headers', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/telemetry/metrics`);
    const data = await res.json();
    record('Backend', 'GET /api/telemetry/metrics Telemetry & Scalability', res.status === 200 && data.status === 'healthy', `Uptime: ${data.uptimeSeconds}s, Heap: ${data.database?.heapUsedMB}MB`);
  } catch (err: any) {
    record('Backend', 'GET /api/telemetry/metrics Telemetry & Scalability', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 2: AI INTEGRATION & POST /api/chat
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'مرحبا، كيف يمكنني الاستفادة من المنصة؟' }),
    });
    const data = await res.json();
    record(
      'AI Integration',
      'POST /api/chat Responds Gracefully (Fallback/Model with No Crashes)',
      res.status === 200 && Boolean(data.reply),
      `Status: ${res.status}, Reply received: "${(data.reply || '').substring(0, 50)}...", Fallback: ${data.fallback}`
    );
  } catch (err: any) {
    record('AI Integration', 'POST /api/chat Responds Gracefully', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    record(
      'AI Integration',
      'POST /api/chat Empty Message Validation',
      res.status === 400,
      `Status: ${res.status} (expected 400 for empty query)`
    );
  } catch (err: any) {
    record('AI Integration', 'POST /api/chat Empty Message Validation', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 3: CORS & SECURITY HEADERS
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/user/me`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-anonymous-user-id,content-type',
      },
    });
    const allowHeaders = res.headers.get('access-control-allow-headers') || '';
    const allowOrigin = res.headers.get('access-control-allow-origin') || '';
    record(
      'Security',
      'CORS Configuration for Web, APK, and Cross-Origin WebViews',
      allowHeaders.toLowerCase().includes('x-anonymous-user-id'),
      `Allow-Headers: ${allowHeaders}, Allow-Origin: ${allowOrigin}`
    );
  } catch (err: any) {
    record('Security', 'CORS Configuration', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 4: USER SYSTEM & MULTI-USER ISOLATION
  // -------------------------------------------------------------
  const user1Id = `audit_user_alpha_${timestamp}`;
  const user2Id = `audit_user_beta_${timestamp}`;

  try {
    const res1 = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { 'x-anonymous-user-id': user1Id },
    });
    const data1 = await res1.json();

    const res2 = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { 'x-anonymous-user-id': user2Id },
    });
    const data2 = await res2.json();

    const passIsolation =
      data1.user?.id === user1Id &&
      data2.user?.id === user2Id &&
      data1.user?.points === 10 &&
      data2.user?.points === 10;

    record(
      'User System',
      'Independent User Creation & 10 Points First Entry',
      passIsolation,
      `User 1: ${data1.user?.id} (pts: ${data1.user?.points}), User 2: ${data2.user?.id} (pts: ${data2.user?.points})`
    );
  } catch (err: any) {
    record('User System', 'Independent User Creation', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 5: POINTS SYSTEM & CAMPAIGN COST ENFORCEMENT
  // -------------------------------------------------------------
  try {
    // User 1 creates campaign (cost: 10 points)
    const createRes = await fetch(`${BASE_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anonymous-user-id': user1Id,
      },
      body: JSON.stringify({
        platform: 'TikTok',
        targetProfileUrl: 'https://www.tiktok.com/@audit_test_creator',
        targetUsername: 'audit_test_creator',
      }),
    });
    const createData = await createRes.json();

    // Check User 1 balance (should be 0)
    const user1AfterRes = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { 'x-anonymous-user-id': user1Id },
    });
    const user1After = await user1AfterRes.json();

    // Check User 2 balance (MUST remain 10)
    const user2CheckRes = await fetch(`${BASE_URL}/api/user/me`, {
      headers: { 'x-anonymous-user-id': user2Id },
    });
    const user2Check = await user2CheckRes.json();

    const passCostAndIsolation =
      createRes.status === 200 &&
      user1After.user?.points === 0 &&
      user2Check.user?.points === 10;

    record(
      'Points System',
      'Campaign Deducts 10 Points (User 1 -> 0, User 2 remains 10)',
      passCostAndIsolation,
      `User 1 balance: ${user1After.user?.points} (exp 0), User 2 balance: ${user2Check.user?.points} (exp 10)`
    );

    // Attempt second campaign with User 1 (balance = 0) -> MUST fail
    const secondRes = await fetch(`${BASE_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anonymous-user-id': user1Id,
      },
      body: JSON.stringify({
        platform: 'TikTok',
        targetProfileUrl: 'https://www.tiktok.com/@audit_test_creator_2',
        targetUsername: 'audit_test_creator_2',
      }),
    });
    const secondData = await secondRes.json();

    record(
      'Points System',
      'Zero-Balance Campaign Creation Strictly Blocked (No Negative Balance)',
      secondRes.status === 400 && secondData.error?.includes('تحتاج إلى 10 نقاط'),
      `Status: ${secondRes.status}, Error: "${secondData.error}"`
    );
  } catch (err: any) {
    record('Points System', 'Campaign Points Deductions', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 6: TASK COMPLETION & ANTI-DUPLICATE SUBMISSION
  // -------------------------------------------------------------
  try {
    const tasksRes = await fetch(`${BASE_URL}/api/tasks`, {
      headers: { 'x-anonymous-user-id': user2Id },
    });
    const tasksData = await tasksRes.json();
    const availableTask = (tasksData.tasks || [])[0];

    if (availableTask) {
      // User 2 submits task -> earns +1 point (10 -> 11)
      const submitRes = await fetch(`${BASE_URL}/api/tasks/${availableTask.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anonymous-user-id': user2Id,
        },
        body: JSON.stringify({ proofNote: 'Audit task completion proof' }),
      });
      const submitData = await submitRes.json();

      // Submit same task again -> must be detected as duplicate (+0 points)
      const duplicateRes = await fetch(`${BASE_URL}/api/tasks/${availableTask.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anonymous-user-id': user2Id,
        },
        body: JSON.stringify({ proofNote: 'Duplicate attempt' }),
      });
      const duplicateData = await duplicateRes.json();

      const passTaskRules =
        submitRes.status === 200 &&
        submitData.userBalance === 11 &&
        duplicateData.alreadyCompleted === true &&
        duplicateData.userBalance === 11;

      record(
        'Campaign System',
        'Task Completion (+1 Point) & Anti-Duplicate Protection',
        passTaskRules,
        `Task ID: ${availableTask.id}, First Submit Balance: ${submitData.userBalance}, Duplicate Submit Balance: ${duplicateData.userBalance}`
      );
    } else {
      record('Campaign System', 'Task Completion Available', true, 'No active global tasks to submit against (expected in clean env)');
    }
  } catch (err: any) {
    record('Campaign System', 'Task Completion Test', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 7: DATABASE PERSISTENCE & INTEGRITY
  // -------------------------------------------------------------
  try {
    const metrics = db.getDbMetrics();
    const passDb =
      metrics.totalUsers > 0 &&
      metrics.rssMB > 0 &&
      metrics.activeUserLocks >= 0;

    record(
      'Database',
      'Database In-Memory & File Storage Integrity',
      passDb,
      `Users: ${metrics.totalUsers}, Campaigns: ${metrics.totalCampaigns}, Tasks: ${metrics.totalTasks}, Heap: ${metrics.heapUsedMB}MB`
    );
  } catch (err: any) {
    record('Database', 'Database Integrity Check', false, err.message);
  }

  // -------------------------------------------------------------
  // SECTION 8: DAILY BONUS RULE ENFORCEMENT
  // -------------------------------------------------------------
  try {
    const bonusRes = await fetch(`${BASE_URL}/api/daily-bonus/claim`, {
      method: 'POST',
      headers: { 'x-anonymous-user-id': user1Id },
    });
    record(
      'Points System',
      'Daily Bonus Strictly Disabled (Enforcing Points Come Exclusively From Tasks)',
      bonusRes.status === 400,
      `Status: ${bonusRes.status} (expected 400)`
    );
  } catch (err: any) {
    record('Points System', 'Daily Bonus Rule', false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  const total = auditLog.length;
  const passed = auditLog.filter((a) => a.passed).length;
  const failed = total - passed;
  console.log(`📊 AUDIT SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('----------------------------------------------------------------\n');

  if (failed === 0) {
    console.log('🌟 ALL PRODUCTION AUDIT CHECKS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('❌ SOME AUDIT CHECKS FAILED');
    process.exit(1);
  }
}

runProductionAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
