-- =========================================================
-- MIGRATION 011: BIRTHDAY & MEMBER LOYALTY
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. MEMBER LOYALTY
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- Điểm hiện tại
    points_balance INTEGER NOT NULL DEFAULT 0
        CHECK (points_balance >= 0),

    -- Tổng điểm đã tích luỹ
    lifetime_earned INTEGER NOT NULL DEFAULT 0
        CHECK (lifetime_earned >= 0),

    -- Tổng điểm đã sử dụng
    lifetime_spent INTEGER NOT NULL DEFAULT 0
        CHECK (lifetime_spent >= 0),

    -- Hạng thành viên
    tier VARCHAR(30) NOT NULL DEFAULT 'member'
        CHECK (
            tier IN (
                'member',
                'silver',
                'gold',
                'platinum'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. LOYALTY POINT TRANSACTIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.loyalty_point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    -- Có thể liên kết với đơn hàng
    order_id UUID NULL
        REFERENCES orders.customer_orders(id)
        ON DELETE SET NULL,

    transaction_type VARCHAR(30) NOT NULL
        CHECK (
            transaction_type IN (
                'earn',
                'spend',
                'refund',
                'adjustment',
                'expire',
                'birthday_bonus'
            )
        ),

    points INTEGER NOT NULL
        CHECK (points <> 0),

    balance_after INTEGER NOT NULL
        CHECK (balance_after >= 0),

    description TEXT,

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. BIRTHDAY SETTINGS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.birthday_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- Ngày sinh
    birth_date DATE,

    -- Cho phép nhận ưu đãi sinh nhật
    birthday_reward_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Đã xác minh ngày sinh
    birth_date_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Năm gần nhất đã nhận quà
    last_reward_year INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. BIRTHDAY REWARDS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.birthday_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    reward_year INTEGER NOT NULL,

    reward_type VARCHAR(30) NOT NULL
        CHECK (
            reward_type IN (
                'voucher',
                'points',
                'food',
                'discount'
            )
        ),

    voucher_id UUID NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE SET NULL,

    points INTEGER
        CHECK (
            points IS NULL
            OR points > 0
        ),

    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'issued',
                'used',
                'expired',
                'cancelled'
            )
        ),

    issued_at TIMESTAMPTZ,

    used_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, reward_year)
);

-- ---------------------------------------------------------
-- 5. MEMBER TIER HISTORY
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.loyalty_tier_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    old_tier VARCHAR(30),

    new_tier VARCHAR(30) NOT NULL,

    reason TEXT,

    changed_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 6. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user
ON member.loyalty_point_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order
ON member.loyalty_point_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created
ON member.loyalty_point_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type
ON member.loyalty_point_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_birthday_rewards_user
ON member.birthday_rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_birthday_rewards_status
ON member.birthday_rewards(status);

CREATE INDEX IF NOT EXISTS idx_birthday_rewards_expiry
ON member.birthday_rewards(expires_at);

CREATE INDEX IF NOT EXISTS idx_tier_history_user
ON member.loyalty_tier_history(user_id);

CREATE INDEX IF NOT EXISTS idx_tier_history_created
ON member.loyalty_tier_history(created_at DESC);

-- =========================================================
-- END MIGRATION 011
-- =========================================================