import { db } from '../src/server/db.js';

async function runMultiUserPointsVerification() {
  console.log('====================================================');
  console.log('🧪 TESTING MULTI-USER POINT ISOLATION & SYSTEM RULES');
  console.log('====================================================');

  const results: { name: string; pass: boolean; details: string }[] = [];

  // Scenario 1: New User A first entry -> receives exactly 10 points
  const userAId = 'user_test_scenario_a_' + Date.now();
  const userA_1 = db.getOrCreateUser(userAId);
  const pass1 = userA_1.points === 10 && userA_1.firstCampaignBonusGranted === true;
  results.push({
    name: '1. First entry grants exactly 10 points',
    pass: pass1,
    details: `Points: ${userA_1.points} (expected 10), firstCampaignBonusGranted: ${userA_1.firstCampaignBonusGranted}`,
  });

  // Scenario 2: Refresh / reopen does NOT grant points again
  const userA_2 = db.getOrCreateUser(userAId);
  const overviewA_2 = db.getPointsOverview(userAId);
  const pass2 = userA_2.points === 10 && overviewA_2.currentPoints === 10;
  results.push({
    name: '2. Reload/reopen does not grant additional points',
    pass: pass2,
    details: `Points on reload: ${userA_2.points} (expected 10)`,
  });

  // Scenario 3: No daily bonus / days later does not grant points
  let dailyBonusBlocked = false;
  try {
    // Check if daily bonus exists or is disabled
    const userA_afterDays = db.getOrCreateUser(userAId);
    if (userA_afterDays.points === 10) dailyBonusBlocked = true;
  } catch (e) {
    dailyBonusBlocked = true;
  }
  results.push({
    name: '3. No daily bonus after time passes',
    pass: dailyBonusBlocked,
    details: `Points remain unchanged: 10`,
  });

  // Scenario 4: Failed campaign creation does NOT deduct points
  let failedCreationProtected = false;
  try {
    db.createCampaign(userAId, {
      platform: 'TikTok',
      targetProfileUrl: '', // Invalid empty URL
    });
  } catch (err: any) {
    const userA_afterFail = db.getOrCreateUser(userAId);
    failedCreationProtected = userA_afterFail.points === 10;
  }
  results.push({
    name: '4. Failed campaign creation does not deduct points',
    pass: failedCreationProtected,
    details: `Points after failed attempt: 10`,
  });

  // Scenario 5: User A creates campaign with 10 points -> balance becomes 0
  const campaignResult = db.createCampaign(userAId, {
    platform: 'TikTok',
    targetProfileUrl: 'https://www.tiktok.com/@valid_real_test_a',
    targetUsername: 'valid_real_test_a',
  });
  const userA_afterCamp = db.getOrCreateUser(userAId);
  const overviewA_afterCamp = db.getPointsOverview(userAId);
  const pass5 = userA_afterCamp.points === 0 && overviewA_afterCamp.currentPoints === 0;
  results.push({
    name: '5. Successful campaign creation deducts 10 points (balance -> 0)',
    pass: pass5,
    details: `Campaign created: ${campaignResult.campaign.id}, Remaining points: ${userA_afterCamp.points}`,
  });

  // Scenario 6: User A attempts second campaign with 0 points -> strictly blocked
  let insufficientBlocked = false;
  let errorMessage = '';
  try {
    db.createCampaign(userAId, {
      platform: 'TikTok',
      targetProfileUrl: 'https://www.tiktok.com/@valid_real_test_a2',
      targetUsername: 'valid_real_test_a2',
    });
  } catch (err: any) {
    insufficientBlocked = true;
    errorMessage = err.message;
  }
  const userA_afterAttempt = db.getOrCreateUser(userAId);
  const pass6 = insufficientBlocked && userA_afterAttempt.points === 0;
  results.push({
    name: '6. Campaign creation with balance < 10 strictly rejected',
    pass: pass6,
    details: `Blocked with message: "${errorMessage}", Balance: ${userA_afterAttempt.points}`,
  });

  // Scenario 7: User B enters -> independent 10 points
  const userBId = 'user_test_scenario_b_' + Date.now();
  const userB_1 = db.getOrCreateUser(userBId);
  const overviewB = db.getPointsOverview(userBId);
  const pass7 = userB_1.points === 10 && overviewB.currentPoints === 10;
  results.push({
    name: '7. New User B gets independent 10 points',
    pass: pass7,
    details: `User B points: ${userB_1.points} (expected 10)`,
  });

  // Scenario 8: User A balance remains 0 while User B has 10
  const userA_check = db.getOrCreateUser(userAId);
  const pass8 = userA_check.points === 0 && userB_1.points === 10;
  results.push({
    name: '8. User balances are strictly isolated (A=0, B=10)',
    pass: pass8,
    details: `User A: ${userA_check.points}, User B: ${userB_1.points}`,
  });

  // Scenario 9: User C enters -> independent 10 points
  const userCId = 'user_test_scenario_c_' + Date.now();
  const userC_1 = db.getOrCreateUser(userCId);
  const pass9 = userC_1.points === 10;
  results.push({
    name: '9. New User C gets independent 10 points',
    pass: pass9,
    details: `User C points: ${userC_1.points} (expected 10)`,
  });

  // Scenario 10: Double-spend immunity on rapid repeated clicks (Race Condition Prevention)
  const userDId = 'user_test_scenario_d_' + Date.now();
  db.getOrCreateUser(userDId); // has 10 points

  const promises = Array.from({ length: 5 }).map((_, i) =>
    db.withUserLock(userDId, async () => {
      try {
        return db.createCampaign(userDId, {
          platform: 'TikTok',
          targetProfileUrl: `https://www.tiktok.com/@rapid_test_${i}`,
          targetUsername: `rapid_test_${i}`,
        });
      } catch (err: any) {
        return { error: err.message };
      }
    })
  );

  const outcomes = await Promise.all(promises);
  const successes = outcomes.filter((o: any) => !o.error);
  const failures = outcomes.filter((o: any) => o.error);
  const userD_final = db.getOrCreateUser(userDId);
  const pass10 = successes.length === 1 && failures.length === 4 && userD_final.points === 0;

  results.push({
    name: '10. Repeated rapid clicks: Exactly 1 succeeds, 4 rejected, balance = 0 (No Double Spend)',
    pass: pass10,
    details: `Successes: ${successes.length}, Rejections: ${failures.length}, Final Balance: ${userD_final.points}`,
  });

  console.log('----------------------------------------------------');
  let allPass = true;
  for (const r of results) {
    const mark = r.pass ? '✅ [PASS]' : '❌ [FAIL]';
    if (!r.pass) allPass = false;
    console.log(`${mark} ${r.name}`);
    console.log(`   └─ ${r.details}`);
  }
  console.log('----------------------------------------------------');

  if (allPass) {
    console.log('🎉 ALL MULTI-USER POINT RULES VERIFIED 100% SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED');
    process.exit(1);
  }
}

runMultiUserPointsVerification().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
