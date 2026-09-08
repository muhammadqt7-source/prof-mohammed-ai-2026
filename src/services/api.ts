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
let inMemoryUserId: string | null = null;

export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') return 'user_ssr';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.trim() === '') {
      id = 'user_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch (e) {
        // Safe fallback for restricted storage environments
      }
    }
    return id;
  } catch (err) {
    if (!inMemoryUserId) {
      inMemoryUserId = 'user_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    }
    return inMemoryUserId;
  }
}

export function setCustomAnonymousUserId(newId: string) {
  if (typeof window !== 'undefined' && newId.trim()) {
    try {
      localStorage.setItem(STORAGE_KEY, newId.trim());
    } catch (e) {
      inMemoryUserId = newId.trim();
    }
  }
}

export function resetAnonymousUserId(): string {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }
  inMemoryUserId = null;
  return getAnonymousUserId();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const userId = getAnonymousUserId();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-anonymous-user-id', userId);

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

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
