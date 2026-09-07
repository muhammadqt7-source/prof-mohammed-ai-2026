/**
 * Official Account Verification & URL Parsing Module
 * 
 * Strict Compliance Mandates:
 * - NO web scraping or scraping libraries.
 * - NO unofficial or unauthorized third-party APIs.
 * - NO mock avatars or generated images.
 * - NO fake display names.
 * - Only official Meta (Instagram Graph API) and TikTok Open API when credentials are provided.
 * - When official API credentials or permissions are not available or account is not publicly accessible,
 *   the system strictly returns status: 'ACCOUNT_DATA_UNAVAILABLE' and isVerified: false, without fake data.
 */

import { parseProfileUrl } from '../utils/urlParser.js';
import type { ParsedProfileInfo } from '../utils/urlParser.js';
import { cacheGet, cacheSet } from './redis/redisClient.js';
import { query } from './db/postgres.js';
import { appQueue } from './queue/queue.js';

export { parseProfileUrl };
export type { ParsedProfileInfo };

export type AccountStatus = 'VERIFIED' | 'ACCOUNT_DATA_UNAVAILABLE' | 'UNVERIFIED';

export interface VerificationResult {
  isVerified: boolean;
  status: AccountStatus;
  platform: 'Instagram' | 'TikTok';
  username: string;
  profileUrl: string;
  displayName?: string;
  avatarUrl?: string;
  verifiedAt?: string;
  reason?: string;
  source?: string;
}

const CACHE_TTL_VERIFIED = 86400; // 24 hours for verified real accounts
const CACHE_TTL_UNAVAILABLE = 300; // 5 minutes for unavailable to allow retry

/**
 * Verifies account via official APIs with Redis caching and PostgreSQL persistence.
 * 
 * Strict Constraint:
 * If official API access is not configured, fails, or account data is not returned,
 * returns status: 'ACCOUNT_DATA_UNAVAILABLE' with isVerified: false.
 * NEVER creates fake avatar or fake display name.
 */
export async function verifyAccountWithOfficialApi(
  platform: 'Instagram' | 'TikTok',
  cleanUsername: string,
  profileUrl: string
): Promise<VerificationResult> {
  const normUsername = cleanUsername.toLowerCase().trim();
  const cacheKey = `account:${platform.toLowerCase()}:${normUsername}`;

  // 1. Check Redis Cache First (O(1) high-speed response)
  const cached = await cacheGet<VerificationResult>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. Check PostgreSQL Database
  try {
    const dbRes = await query(
      `SELECT platform, username, profile_url, display_name, avatar_url, is_verified, status, last_checked_at 
       FROM target_accounts 
       WHERE platform = $1 AND username = $2`,
      [platform, normUsername]
    );

    if (dbRes.rows.length > 0) {
      const row = dbRes.rows[0];
      const lastChecked = row.last_checked_at ? new Date(row.last_checked_at).getTime() : 0;
      const isFresh = Date.now() - lastChecked < CACHE_TTL_VERIFIED * 1000;

      if (isFresh && row.is_verified) {
        const result: VerificationResult = {
          isVerified: true,
          status: 'VERIFIED',
          platform,
          username: row.username,
          profileUrl: row.profile_url,
          displayName: row.display_name || undefined,
          avatarUrl: row.avatar_url || undefined,
          verifiedAt: row.last_checked_at,
          source: 'DATABASE_CACHE',
        };
        await cacheSet(cacheKey, result, CACHE_TTL_VERIFIED);
        return result;
      }
    }
  } catch (err: any) {
    // Database might be initializing or offline, proceed safely to API
    console.warn('[AccountVerification] DB check notice:', err.message);
  }

  // 3. Official Meta Graph API for Instagram
  if (platform === 'Instagram') {
    const metaToken = process.env.INSTAGRAM_GRAPH_TOKEN || process.env.META_ACCESS_TOKEN;
    const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID || 'me';

    if (metaToken) {
      try {
        const metaApiUrl = `https://graph.facebook.com/v19.0/${igAccountId}?fields=business_discovery.username(${encodeURIComponent(
          normUsername
        )}){username,name,profile_picture_url,website}&access_token=${encodeURIComponent(metaToken)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(metaApiUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          const discovery = data.business_discovery;
          if (discovery && discovery.username) {
            const verifiedResult: VerificationResult = {
              isVerified: true,
              status: 'VERIFIED',
              platform: 'Instagram',
              username: discovery.username,
              profileUrl,
              displayName: discovery.name || discovery.username,
              avatarUrl: discovery.profile_picture_url || undefined,
              verifiedAt: new Date().toISOString(),
              source: 'META_GRAPH_API',
            };

            await persistTargetAccount(verifiedResult);
            await cacheSet(cacheKey, verifiedResult, CACHE_TTL_VERIFIED);
            return verifiedResult;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[Meta Graph API] Status ${res.status}:`, errData);
        }
      } catch (err: any) {
        console.warn('[Meta Graph API] Verification error:', err.message);
      }
    }

    // Official credentials not configured or API did not return verified data
    const unavailableResult: VerificationResult = {
      isVerified: false,
      status: 'ACCOUNT_DATA_UNAVAILABLE',
      platform: 'Instagram',
      username: normUsername,
      profileUrl,
      displayName: undefined,
      avatarUrl: undefined,
      reason: 'البيانات الرسمية للحساب غير متوفرة حالياً عبر واجهة Meta Graph API الرسمية (ACCOUNT_DATA_UNAVAILABLE).',
    };

    await persistTargetAccount(unavailableResult);
    await cacheSet(cacheKey, unavailableResult, CACHE_TTL_UNAVAILABLE);
    return unavailableResult;
  }

  // 4. Official TikTok Open API
  if (platform === 'TikTok') {
    const tiktokToken = process.env.TIKTOK_ACCESS_TOKEN;

    if (tiktokToken) {
      try {
        const tiktokApiUrl = `https://open.tiktokapis.com/v2/user/info/?fields=avatar_url,display_name,username`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(tiktokApiUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tiktokToken}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          const userInfo = data.data?.user;
          if (userInfo && userInfo.username && userInfo.username.toLowerCase() === normUsername) {
            const verifiedResult: VerificationResult = {
              isVerified: true,
              status: 'VERIFIED',
              platform: 'TikTok',
              username: userInfo.username,
              profileUrl,
              displayName: userInfo.display_name,
              avatarUrl: userInfo.avatar_url,
              verifiedAt: new Date().toISOString(),
              source: 'TIKTOK_OPEN_API',
            };

            await persistTargetAccount(verifiedResult);
            await cacheSet(cacheKey, verifiedResult, CACHE_TTL_VERIFIED);
            return verifiedResult;
          }
        }
      } catch (err: any) {
        console.warn('[TikTok API] Verification error:', err.message);
      }
    }

    // Official credentials not configured or API did not return data
    const unavailableResult: VerificationResult = {
      isVerified: false,
      status: 'ACCOUNT_DATA_UNAVAILABLE',
      platform: 'TikTok',
      username: normUsername,
      profileUrl,
      displayName: undefined,
      avatarUrl: undefined,
      reason: 'البيانات الرسمية للحساب غير متوفرة حالياً عبر TikTok Open API الرسمي (ACCOUNT_DATA_UNAVAILABLE).',
    };

    await persistTargetAccount(unavailableResult);
    await cacheSet(cacheKey, unavailableResult, CACHE_TTL_UNAVAILABLE);
    return unavailableResult;
  }

  return {
    isVerified: false,
    status: 'ACCOUNT_DATA_UNAVAILABLE',
    platform,
    username: normUsername,
    profileUrl,
    reason: 'منصة غير مدعومة للتحقق الرسمي.',
  };
}

/**
 * Persists target account record to PostgreSQL target_accounts
 */
async function persistTargetAccount(result: VerificationResult): Promise<void> {
  try {
    const id = `ta_${result.platform.toLowerCase()}_${result.username}`;
    await query(
      `INSERT INTO target_accounts 
        (id, platform, username, profile_url, display_name, avatar_url, is_verified, status, verification_source, last_checked_at, updated_at)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (platform, username) 
       DO UPDATE SET 
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        is_verified = EXCLUDED.is_verified,
        status = EXCLUDED.status,
        verification_source = EXCLUDED.verification_source,
        last_checked_at = NOW(),
        updated_at = NOW()`,
      [
        id,
        result.platform,
        result.username,
        result.profileUrl,
        result.displayName || null,
        result.avatarUrl || null,
        result.isVerified,
        result.status,
        result.source || null,
      ]
    );
  } catch (err: any) {
    // Log notice if DB is not currently connected
    console.warn('[AccountVerification] DB persist notice:', err.message);
  }
}

// Register background queue handler for metadata refresh
appQueue.registerHandler('ACCOUNT_METADATA_REFRESH', async (job) => {
  const { platform, username, profileUrl } = job.payload;
  console.log(`[Queue Worker] Refreshing metadata for ${platform}: @${username}`);
  await verifyAccountWithOfficialApi(platform, username, profileUrl);
});
