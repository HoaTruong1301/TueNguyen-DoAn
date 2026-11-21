-- =========================================================
-- MIGRATION 008: PROMOTION / VOUCHER
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. VOUCHERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Loại giảm giá
    discount_type VARCHAR(20) NOT NULL
        CHECK (
            discount_type IN (
                'percentage',
                'fixed_amount'
            )
        ),

    -- Giá trị giảm
    discount_value NUMERIC(14,2) NOT NULL
        CHECK (discount_value >= 0),

    -- Giảm tối đa khi dùng %
    max_discount_amount NUMERIC(14,2)
        CHECK (
            max_discount_amount IS NULL
            OR max_discount_amount >= 0
        ),

    -- Đơn tối thiểu
    min_order_amount NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (min_order_amount >= 0),

    -- Tổng số lượt được sử dụng
    usage_limit INTEGER
        CHECK (
            usage_limit IS NULL
            OR usage_limit > 0
        ),

    -- Số lượt đã sử dụng
    used_count INTEGER NOT NULL DEFAULT 0
        CHECK (used_count >= 0),

    -- Giới hạn mỗi khách hàng
    per_user_limit INTEGER
        CHECK (
            per_user_limit IS NULL
            OR per_user_limit > 0
        ),

    -- Thời gian hiệu lực
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT vouchers_valid_time
        CHECK (ends_at > starts_at),

    CONSTRAINT vouchers_percentage_valid
        CHECK (
            discount_type <> 'percentage'
            OR discount_value <= 100
        )
);

-- ---------------------------------------------------------
-- 2. VOUCHER USER LIMITS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion.voucher_user_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_id UUID NOT NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    usage_count INTEGER NOT NULL DEFAULT 0
        CHECK (usage_count >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (voucher_id, user_id)
);

-- ---------------------------------------------------------
-- 3. VOUCHER USAGE HISTORY
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion.voucher_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_id UUID NOT NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE RESTRICT,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    order_id UUID NOT NULL
        REFERENCES orders.customer_orders(id)
        ON DELETE RESTRICT,

    discount_amount NUMERIC(14,2) NOT NULL
        CHECK (discount_amount >= 0),

    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. VOUCHER CATEGORY CONDITIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion.voucher_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_id UUID NOT NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE CASCADE,

    category_id UUID NOT NULL
        REFERENCES menu.food_categories(id)
        ON DELETE CASCADE,

    UNIQUE (voucher_id, category_id)
);

-- ---------------------------------------------------------
-- 5. VOUCHER FOOD CONDITIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS promotion.voucher_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_id UUID NOT NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE CASCADE,

    food_id UUID NOT NULL
        REFERENCES menu.foods(id)
        ON DELETE CASCADE,

    UNIQUE (voucher_id, food_id)
);

-- ---------------------------------------------------------
-- 6. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_vouchers_active
ON promotion.vouchers(is_active);

CREATE INDEX IF NOT EXISTS idx_vouchers_time
ON promotion.vouchers(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_vouchers_code_lower
ON promotion.vouchers(LOWER(code));

CREATE INDEX IF NOT EXISTS idx_voucher_user_limits_user
ON promotion.voucher_user_limits(user_id);

CREATE INDEX IF NOT EXISTS idx_voucher_usage_voucher
ON promotion.voucher_usage_history(voucher_id);

CREATE INDEX IF NOT EXISTS idx_voucher_usage_user
ON promotion.voucher_usage_history(user_id);

CREATE INDEX IF NOT EXISTS idx_voucher_usage_order
ON promotion.voucher_usage_history(order_id);

CREATE INDEX IF NOT EXISTS idx_voucher_categories_voucher
ON promotion.voucher_categories(voucher_id);

CREATE INDEX IF NOT EXISTS idx_voucher_foods_voucher
ON promotion.voucher_foods(voucher_id);

-- =========================================================
-- END MIGRATION 008
-- =========================================================