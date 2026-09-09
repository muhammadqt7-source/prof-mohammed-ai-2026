import {
  AnonymousUser,
  Campaign,
  Task,
  TaskCompletion,
  PointTransaction,
  AdminAuditLog,
  TaskType,
} from '../types.js';

const STORAGE_KEY = 'pm_ai_anonymous_user_id';
const PROD_API_BASE = 'https://ais-pre-7z7jrxyafwqfvjsdtxocqr-838145071042.europe-west2.run.app';
let inMemoryUserId: string | null = null;

function isValidStoredId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 5) return false;
  if (trimmed === 'user_default' || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'user_ssr') {
    return false;
  }
  return true;
}

function generateNewUserId(): string {
  return 'user_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') return 'user_ssr';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!isValidStoredId(id)) {
      // Also check cookie
      if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(/pm_ai_anonymous_user_id=([^;]+)/);
        if (match && match[1] && isValidStoredId(decodeURIComponent(match[1].trim()))) {
          id = decodeURIComponent(match[1].trim());
        }
      }
    }

    if (!isValidStoredId(id)) {
      id = generateNewUserId();
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // Safe fallback for restricted private browsing or WebView storage
      }
    }

    // Keep cookie synchronized as redundant backup for proxies & WebViews
    if (typeof document !== 'undefined' && id) {
      try {
        document.cookie = `pm_ai_anonymous_user_id=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    }

    inMemoryUserId = id;
    return id;
  } catch (err) {
    if (!isValidStoredId(inMemoryUserId)) {
      inMemoryUserId = generateNewUserId();
    }
    return inMemoryUserId!;
  }
}

export function setCustomAnonymousUserId(newId: string) {
  if (typeof window !== 'undefined' && isValidStoredId(newId)) {
    const cleanId = newId.trim();
    try {
      localStorage.setItem(STORAGE_KEY, cleanId);
    } catch {}
    if (typeof document !== 'undefined') {
      try {
        document.cookie = `pm_ai_anonymous_user_id=${encodeURIComponent(cleanId)}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    }
    inMemoryUserId = cleanId;
  }
}

export function resetAnonymousUserId(): string {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (typeof document !== 'undefined') {
      try {
        document.cookie = 'pm_ai_anonymous_user_id=; path=/; max-age=0; SameSite=Lax';
      } catch {}
    }
  }
  inMemoryUserId = null;
  return getAnonymousUserId();
}

function resolveApiUrl(endpoint: string, userId: string): string {
  let base = '';
  // If running in an APK wrapper (file:// or non-http protocol), target the production backend URL
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')
  ) {
    base = PROD_API_BASE;
  }

  const url = `${base}${endpoint}`;
  // Append anonymousUserId to query string to ensure it survives proxies, headers stripping, and webviews
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}anonymousUserId=${encodeURIComponent(userId)}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const userId = getAnonymousUserId();
  const url = resolveApiUrl(endpoint, userId);

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-anonymous-user-id', userId);
  headers.set('X-Anonymous-User-Id', userId);

  // If request has JSON body and is an object, also inject anonymousUserId into the body payload
  let body = options.body;
  if (body && typeof body === 'string' && options.method && options.method !== 'GET') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsed.anonymousUserId = userId;
        body = JSON.stringify(parsed);
      }
    } catch {}
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body,
  });

  // Verify server confirmed anonymous user id in response headers
  const returnedUserId = res.headers.get('x-anonymous-user-id');
  if (returnedUserId && isValidStoredId(returnedUserId) && returnedUserId !== userId) {
    setCustomAnonymousUserId(returnedUserId);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data as T;
}

export const api = {
  // User Profile
  async getUserProfile(): Promise<{ user: AnonymousUser }> {
    return request<{ user: AnonymousUser }>('/api/user/me');
  },

  // Tasks
  async getTasks(): Promise<{
    tasks: (Task & {
      userCompletionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
      userCompletionId: string | null;
    })[];
  }> {
    return request('/api/tasks');
  },

  async getTask(id: string): Promise<{
    task: Task & {
      userCompletionStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
      userCompletionId: string | null;
    };
  }> {
    return request(`/api/tasks/${id}`);
  },

  async submitTask(
    taskId: string,
    proofNote?: string
  ): Promise<{ success: boolean; message: string; completion: TaskCompletion }> {
    return request(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ proofNote }),
    });
  },

  // Campaigns
  async getCampaigns(): Promise<{ campaigns: Campaign[] }> {
    return request('/api/campaigns');
  },

  async getCampaign(id: string): Promise<{ campaign: Campaign }> {
    return request(`/api/campaigns/${id}`);
  },

  // Official Account Verification API
  async verifyAccount(payload: {
    profileUrl: string;
    platform?: string;
  }): Promise<{
    success: boolean;
    platform: 'Instagram' | 'TikTok';
    targetPlatform: string;
    username: string;
    cleanUsername: string;
    canonicalUrl: string;
    profileUrl: string;
    isVerified: boolean;
    targetAccountVerified: boolean;
    displayName?: string | null;
    targetDisplayName?: string | null;
    avatarUrl?: string | null;
    targetAvatarUrl?: string | null;
    reason?: string | null;
  }> {
    return request('/api/accounts/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createCampaign(payload: {
    title?: string;
    description?: string;
    platform: string;
    targetPlatform?: string;
    taskType?: TaskType;
    targetUsername?: string;
    targetProfileUrl?: string;
    targetDisplayName?: string;
    targetAvatarUrl?: string;
    targetUrl?: string;
    isAccountVerified?: boolean;
    targetAccountVerified?: boolean;
    targetCompletions?: number;
    rewardPerCompletion?: number;
    durationMinutes?: number;
  }): Promise<{ success: boolean; message: string; campaign: Campaign; userBalance: number }> {
    return request('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async pauseCampaign(id: string): Promise<{ success: boolean; campaign: Campaign }> {
    return request(`/api/campaigns/${id}/pause`, { method: 'POST' });
  },

  async cancelCampaign(
    id: string
  ): Promise<{ success: boolean; message: string; campaign: Campaign; userBalance: number }> {
    return request(`/api/campaigns/${id}/cancel`, { method: 'POST' });
  },

  async getMyCampaigns(): Promise<{ campaigns: Campaign[] }> {
    return request('/api/my-campaigns');
  },

  // Points & Ledger
  async getPointsOverview(): Promise<{
    currentPoints: number;
    earnedTotal: number;
    spentTotal: number;
    lockedCampaignBudget: number;
    transactionsCount: number;
  }> {
    return request('/api/points');
  },

  async chat(message: string): Promise<{ reply: string; fallback?: boolean; status?: string }> {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getPointHistory(): Promise<{ transactions: PointTransaction[] }> {
    return request('/api/points/history');
  },

  // Progress & Daily Streak
  async getProgress(): Promise<{
    user: AnonymousUser;
    levelInfo: any;
    nextLevelInfo: any;
    progressPercent: number;
    xpForNext: number;
    canClaimToday: boolean;
    milestones: { days: number; xpBonus: number; reached: boolean }[];
  }> {
    return request('/api/progress');
  },

  async claimDailyBonus(): Promise<{
    success: boolean;
    message: string;
    user: AnonymousUser;
    pointsAwarded: number;
    xpAwarded: number;
    streakBonusXp: number;
    currentStreak: number;
  }> {
    return request('/api/daily-bonus/claim', { method: 'POST' });
  },

  // Admin APIs
  async getAdminOverview(): Promise<{
    totalUsers: number;
    activeCampaignsCount: number;
    totalCampaignsCount: number;
    pendingCompletionsCount: number;
    totalTasksCount: number;
    totalTransactionsCount: number;
    recentCompletions: TaskCompletion[];
    recentTransactions: PointTransaction[];
    recentAuditLogs: AdminAuditLog[];
  }> {
    return request('/api/admin/overview');
  },

  async getAdminCompletions(status?: string): Promise<{ completions: TaskCompletion[] }> {
    const q = status ? `?status=${status}` : '';
    return request(`/api/admin/completions${q}`);
  },

  async approveCompletion(
    id: string,
    verificationNote?: string
  ): Promise<{ success: boolean; message: string; completion: TaskCompletion }> {
    return request(`/api/admin/completions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ verificationNote }),
    });
  },

  async rejectCompletion(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; message: string; completion: TaskCompletion }> {
    return request(`/api/admin/completions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async setCampaignStatus(
    id: string,
    action: 'pause' | 'cancel'
  ): Promise<{ success: boolean; campaign: Campaign }> {
    return request(`/api/admin/campaigns/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  async adjustUserPoints(
    targetUserId: string,
    amount: number,
    reason: string
  ): Promise<{ success: boolean; user: AnonymousUser; transaction: PointTransaction }> {
    return request(`/api/admin/users/${targetUserId}/adjust-points`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  },

  async getAdminAuditLogs(): Promise<{ logs: AdminAuditLog[] }> {
    return request('/api/admin/audit-logs');
  },

  async getAdminUsers(): Promise<{ users: AnonymousUser[] }> {
    return request('/api/admin/users');
  },
};
