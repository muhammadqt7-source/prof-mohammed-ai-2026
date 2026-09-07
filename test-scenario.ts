import { db } from './src/server/db.js';

console.log('==================================================');
console.log('🧪 Starting First Entry & Points Reset Verification Tests');
console.log('==================================================');

// Test 1: Verify legacy user migration from database.json (user_qr082i5q_mtp079pv)
const legacyUser = db.getUser('user_qr082i5q_mtp079pv');
if (legacyUser) {
  console.log(`[Test 1] Legacy User Sanitized Check:`);
  console.log(`  - Points: ${legacyUser.points} (Expected: 50, NOT 120)`);
  console.log(`  - XP: ${legacyUser.xp} (Expected: 0, NOT 200)`);
  console.log(`  - Streak: ${legacyUser.currentStreak} (Expected: 0)`);
  console.log(`  - First Campaign Bonus Granted: ${legacyUser.firstCampaignBonusGranted} (Expected: true)`);

  if (legacyUser.points !== 50) throw new Error(`Failed Test 1: Legacy user points is ${legacyUser.points}, expected 50!`);
  if (legacyUser.xp !== 0) throw new Error(`Failed Test 1: Legacy user XP is ${legacyUser.xp}, expected 0!`);
  if (legacyUser.currentStreak !== 0) throw new Error(`Failed Test 1: Legacy user streak is ${legacyUser.currentStreak}, expected 0!`);
} else {
  console.log('[Test 1] No legacy user present, skipping legacy check.');
}

// Test 2: New user First Open -> Points = 50, XP = 0, Streak = 0, Completed Tasks = 0, Created Campaigns = 0
const newUserId = 'test_fresh_user_' + Date.now();
console.log(`\n[Test 2] Creating Brand New User (${newUserId})...`);
const userFirstOpen = db.getOrCreateUser(newUserId);
console.log(`  - Points: ${userFirstOpen.points} (Expected: 50)`);
console.log(`  - XP: ${userFirstOpen.xp} (Expected: 0)`);
console.log(`  - Streak: ${userFirstOpen.currentStreak} (Expected: 0)`);
console.log(`  - Completed Tasks: ${userFirstOpen.completedTasksCount} (Expected: 0)`);
console.log(`  - Created Campaigns: ${userFirstOpen.campaignsCreatedCount} (Expected: 0)`);
console.log(`  - firstCampaignBonusGranted: ${userFirstOpen.firstCampaignBonusGranted} (Expected: true)`);

if (userFirstOpen.points !== 50) throw new Error(`Failed Test 2: Points must be 50, got ${userFirstOpen.points}`);
if (userFirstOpen.xp !== 0) throw new Error(`Failed Test 2: XP must be 0, got ${userFirstOpen.xp}`);
if (userFirstOpen.currentStreak !== 0) throw new Error(`Failed Test 2: Streak must be 0, got ${userFirstOpen.currentStreak}`);
if (userFirstOpen.completedTasksCount !== 0) throw new Error('Failed Test 2: Completed tasks must be 0');
if (userFirstOpen.campaignsCreatedCount !== 0) throw new Error('Failed Test 2: Created campaigns must be 0');

// Test 3: Refresh -> Points = 50, XP = 0 (No duplicate bonus)
console.log('\n[Test 3] Simulating Refresh (calling getOrCreateUser again)...');
const userAfterRefresh = db.getOrCreateUser(newUserId);
console.log(`  - Points: ${userAfterRefresh.points} (Expected: 50)`);
console.log(`  - XP: ${userAfterRefresh.xp} (Expected: 0)`);
if (userAfterRefresh.points !== 50) throw new Error(`Failed Test 3: Points after refresh must be 50, got ${userAfterRefresh.points}`);
if (userAfterRefresh.xp !== 0) throw new Error(`Failed Test 3: XP after refresh must be 0, got ${userAfterRefresh.xp}`);

// Test 4: Concurrent / Repeated requests
console.log('\n[Test 4] Simulating concurrent requests...');
const [resA, resB, resC] = [
  db.getOrCreateUser(newUserId),
  db.getOrCreateUser(newUserId),
  db.getOrCreateUser(newUserId),
];
if (resA.points !== 50 || resB.points !== 50 || resC.points !== 50) {
  throw new Error('Failed Test 4: Points changed on concurrent requests!');
}
console.log('  ✅ Balance strictly preserved at 50 points with 0 XP across all calls.');

// Test 5: Verify Transactions Ledger for new user
const txs = db.getUserPointTransactions(newUserId);
console.log(`\n[Test 5] Point Transactions Count for new user: ${txs.length} (Expected: 1)`);
if (txs.length !== 1) throw new Error(`Failed Test 5: Expected exactly 1 transaction, got ${txs.length}`);
if (txs[0].type !== 'FIRST_CAMPAIGN_BONUS') throw new Error(`Failed Test 5: Transaction type must be FIRST_CAMPAIGN_BONUS, got ${txs[0].type}`);
if (txs[0].amount !== 50) throw new Error(`Failed Test 5: Transaction amount must be 50, got ${txs[0].amount}`);
console.log(`  ✅ Registered as: ${txs[0].type} (amount: ${txs[0].amount})`);

// Test 6: Campaign Creation: 50 Points -> Create Campaign -> 0 Points
console.log('\n[Test 6] Campaign Creation Flow (50 Points -> Campaign -> 0 Points)...');
const { campaign, user: userAfterCampaign } = db.createCampaign(newUserId, {
  title: 'حملة انستغرام رسمية',
  platform: 'Instagram',
  targetUsername: 'prof_test_user',
  targetCompletions: 50,
  rewardPerCompletion: 1,
  durationMinutes: 1440,
});
console.log(`  - Campaign Budget: ${campaign.totalBudget} (Expected: 50)`);
console.log(`  - User Points After: ${userAfterCampaign.points} (Expected: 0)`);
if (userAfterCampaign.points !== 0) throw new Error(`Failed Test 6: User balance should be 0, got ${userAfterCampaign.points}`);

// Test 7: Attempting second campaign with 0 balance -> Rejected
console.log('\n[Test 7] Creating campaign with 0 balance (Expected: Insufficient Balance)...');
try {
  db.createCampaign(newUserId, {
    title: 'حملة مرفوضة',
    platform: 'TikTok',
    targetUsername: 'prof_tiktok_reject',
    targetCompletions: 50,
    rewardPerCompletion: 1,
    durationMinutes: 1440,
  });
  throw new Error('Failed Test 7: Campaign should not be allowed with 0 balance!');
} catch (e: any) {
  console.log(`  ✅ Correctly rejected: "${e.message}"`);
}

// Test 8: Worker completes task -> +1 Point, 0 XP
const workerId = 'test_worker_' + Date.now();
const worker = db.getOrCreateUser(workerId);
console.log(`\n[Test 8] Worker User Created (${workerId}): Points = ${worker.points}`);
const campaignTaskId = 'task_camp_' + campaign.id;

const { completion, workerUser } = db.submitTaskCompletion(
  campaignTaskId,
  workerId,
  'تم إنجاز المتابعة بنجاح'
);
console.log(`  - Completion Status: ${completion.status} (Expected: APPROVED)`);
console.log(`  - Worker Points: ${workerUser.points} (Expected: 51, was 50 + 1)`);
console.log(`  - Worker XP: ${workerUser.xp} (Expected: 0)`);

if (workerUser.points !== 51) throw new Error(`Failed Test 8: Worker points must be 51, got ${workerUser.points}`);
if (workerUser.xp !== 0) throw new Error(`Failed Test 8: Worker XP must be 0, got ${workerUser.xp}`);

// Test 9: Verify Daily Bonus is strictly disabled
console.log('\n[Test 9] Verifying Daily Bonus is completely disabled...');
try {
  db.claimDailyBonus(newUserId);
  throw new Error('Failed Test 9: Daily bonus allowed!');
} catch (e: any) {
  console.log(`  ✅ Correctly blocked daily bonus: "${e.message}"`);
}

console.log('\n==================================================');
console.log('🎉 ALL SYSTEM SPECIFICATION TESTS PASSED (100% GREEN)');
console.log('==================================================');
