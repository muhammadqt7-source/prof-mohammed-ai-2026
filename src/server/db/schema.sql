-- Schema for Professor Mohammad Mahdi AI Platform
-- Production PostgreSQL 14+ Schema with Full ACID Guarantees, Foreign Keys, Unique Constraints, and Performance Indexes

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    points INTEGER NOT NULL DEFAULT 10 CHECK (points >= 0),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level VARCHAR(32) NOT NULL DEFAULT 'BEGINNER',
    current_streak INTEGER NOT NULL DEFAULT 0,
    highest_streak INTEGER NOT NULL DEFAULT 0,
    last_claim_date VARCHAR(32),
    completed_tasks_count INTEGER NOT NULL DEFAULT 0,
    campaigns_created_count INTEGER NOT NULL DEFAULT 0,
    first_campaign_bonus_granted BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(128) PRIMARY KEY,
    anonymous_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_name VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    platform VARCHAR(64) NOT NULL,
    target_platform VARCHAR(64),
    task_type VARCHAR(64) NOT NULL,
    target_username VARCHAR(255),
    target_display_name VARCHAR(255),
    target_avatar_url TEXT,
    is_account_verified BOOLEAN NOT NULL DEFAULT FALSE,
    target_account_verified BOOLEAN NOT NULL DEFAULT FALSE,
    target_url TEXT NOT NULL,
    target_profile_url TEXT,
    target_completions INTEGER NOT NULL DEFAULT 10 CHECK (target_completions > 0),
    current_progress INTEGER NOT NULL DEFAULT 0 CHECK (current_progress >= 0),
    reward_per_completion INTEGER NOT NULL DEFAULT 1 CHECK (reward_per_completion > 0),
    total_budget INTEGER NOT NULL DEFAULT 10 CHECK (total_budget >= 0),
    spent_budget INTEGER NOT NULL DEFAULT 0 CHECK (spent_budget >= 0),
    remaining_budget INTEGER NOT NULL DEFAULT 10 CHECK (remaining_budget >= 0),
    duration_minutes INTEGER NOT NULL DEFAULT 1440,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(128) PRIMARY KEY,
    campaign_id VARCHAR(128) REFERENCES campaigns(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(64) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    target_platform VARCHAR(64),
    target_url TEXT NOT NULL,
    target_profile_url TEXT,
    target_username VARCHAR(255),
    target_display_name VARCHAR(255),
    target_avatar_url TEXT,
    is_account_verified BOOLEAN NOT NULL DEFAULT FALSE,
    target_account_verified BOOLEAN NOT NULL DEFAULT FALSE,
    reward INTEGER NOT NULL DEFAULT 1 CHECK (reward >= 0),
    xp_reward INTEGER NOT NULL DEFAULT 20 CHECK (xp_reward >= 0),
    estimated_minutes INTEGER NOT NULL DEFAULT 2,
    instructions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    total_completions_required INTEGER,
    current_completions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Task Completions (Strict Unique Constraint: UNIQUE(task_id, anonymous_user_id) for Idempotency)
CREATE TABLE IF NOT EXISTS task_completions (
    id VARCHAR(128) PRIMARY KEY,
    task_id VARCHAR(128) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    campaign_id VARCHAR(128) REFERENCES campaigns(id) ON DELETE SET NULL,
    anonymous_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    reward INTEGER NOT NULL DEFAULT 1,
    xp_reward INTEGER NOT NULL DEFAULT 20,
    proof_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verification_note TEXT,
    CONSTRAINT uq_task_completion_user UNIQUE (task_id, anonymous_user_id)
);

-- 5. Point Transactions (Immutable Ledger)
CREATE TABLE IF NOT EXISTS point_transactions (
    id VARCHAR(128) PRIMARY KEY,
    anonymous_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT NOT NULL,
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. XP Transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
    id VARCHAR(128) PRIMARY KEY,
    anonymous_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    xp_before INTEGER NOT NULL,
    xp_after INTEGER NOT NULL,
    description TEXT NOT NULL,
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Target Accounts (Official Verified Social Accounts)
CREATE TABLE IF NOT EXISTS target_accounts (
    id VARCHAR(128) PRIMARY KEY,
    platform VARCHAR(64) NOT NULL,
    username VARCHAR(255) NOT NULL,
    profile_url TEXT NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(64) NOT NULL DEFAULT 'UNVERIFIED', -- 'VERIFIED', 'ACCOUNT_DATA_UNAVAILABLE', 'UNVERIFIED'
    verification_source VARCHAR(64),
    raw_metadata JSONB,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_target_account_platform_user UNIQUE (platform, username)
);

-- 8. Target Account Metadata
CREATE TABLE IF NOT EXISTS account_metadata (
    id VARCHAR(128) PRIMARY KEY,
    target_account_id VARCHAR(128) NOT NULL REFERENCES target_accounts(id) ON DELETE CASCADE,
    key VARCHAR(128) NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_target_account_metadata_key UNIQUE (target_account_id, key)
);

-- 9. Friendships
CREATE TABLE IF NOT EXISTS friendships (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_friendship UNIQUE (user_id, friend_id)
);

-- 10. Messages
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(128) PRIMARY KEY,
    sender_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Admin Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(128) PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_id VARCHAR(128),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PERFORMANCE INDEXES (Optimized for High RPS O(1) & O(log N) Lookups)
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_campaign ON tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_completions_user ON task_completions(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_completions_task ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_pt_user ON point_transactions(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_pt_created ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_transactions(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_target_accounts_plat_user ON target_accounts(platform, username);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
