-- =========================================================
-- MIGRATION 022: APP EVENTS & ANALYTICS
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- =========================================================
-- 1. APP EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    session_id UUID,

    device_id VARCHAR(255),

    event_name VARCHAR(100) NOT NULL,

    event_category VARCHAR(50),

    platform VARCHAR(20)
        CHECK (
            platform IN (
                'android',
                'ios',
                'web',
                'windows',
                'macos',
                'linux',
                'unknown'
            )
        ),

    app_version VARCHAR(50),

    screen_name VARCHAR(255),

    entity_type VARCHAR(100),

    entity_id UUID,

    properties JSONB,

    ip_address INET,

    user_agent TEXT,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. APP SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    device_id VARCHAR(255),

    platform VARCHAR(20)
        CHECK (
            platform IN (
                'android',
                'ios',
                'web',
                'windows',
                'macos',
                'linux',
                'unknown'
            )
        ),

    app_version VARCHAR(50),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    ended_at TIMESTAMPTZ,

    duration_seconds INTEGER,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. SCREEN VIEWS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.screen_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    session_id UUID,

    screen_name VARCHAR(255) NOT NULL,

    previous_screen VARCHAR(255),

    platform VARCHAR(20),

    app_version VARCHAR(50),

    duration_seconds INTEGER,

    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. DAILY ANALYTICS
-- Bảng tổng hợp theo ngày.
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    metric_date DATE NOT NULL,

    metric_name VARCHAR(100) NOT NULL,

    metric_value NUMERIC(20,4) NOT NULL DEFAULT 0,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT daily_metrics_unique
        UNIQUE (
            metric_date,
            metric_name
        )
);

-- =========================================================
-- 5. FOOD ANALYTICS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.food_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    food_id UUID NOT NULL,

    metric_date DATE NOT NULL,

    views_count INTEGER NOT NULL DEFAULT 0,

    favorite_count INTEGER NOT NULL DEFAULT 0,

    cart_add_count INTEGER NOT NULL DEFAULT 0,

    order_count INTEGER NOT NULL DEFAULT 0,

    quantity_sold INTEGER NOT NULL DEFAULT 0,

    revenue NUMERIC(15,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT food_metrics_unique
        UNIQUE (
            food_id,
            metric_date
        )
);

-- =========================================================
-- 6. VOUCHER ANALYTICS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics.voucher_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_id UUID NOT NULL,

    metric_date DATE NOT NULL,

    view_count INTEGER NOT NULL DEFAULT 0,

    apply_count INTEGER NOT NULL DEFAULT 0,

    success_count INTEGER NOT NULL DEFAULT 0,

    failed_count INTEGER NOT NULL DEFAULT 0,

    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT voucher_metrics_unique
        UNIQUE (
            voucher_id,
            metric_date
        )
);

-- =========================================================
-- 7. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_app_events_user
ON analytics.app_events(user_id);

CREATE INDEX IF NOT EXISTS idx_app_events_session
ON analytics.app_events(session_id);

CREATE INDEX IF NOT EXISTS idx_app_events_device
ON analytics.app_events(device_id);

CREATE INDEX IF NOT EXISTS idx_app_events_name
ON analytics.app_events(event_name);

CREATE INDEX IF NOT EXISTS idx_app_events_category
ON analytics.app_events(event_category);

CREATE INDEX IF NOT EXISTS idx_app_events_entity
ON analytics.app_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_app_events_occurred
ON analytics.app_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user
ON analytics.app_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_app_sessions_device
ON analytics.app_sessions(device_id);

CREATE INDEX IF NOT EXISTS idx_app_sessions_active
ON analytics.app_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_app_sessions_started
ON analytics.app_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_screen_views_user
ON analytics.screen_views(user_id);

CREATE INDEX IF NOT EXISTS idx_screen_views_session
ON analytics.screen_views(session_id);

CREATE INDEX IF NOT EXISTS idx_screen_views_screen
ON analytics.screen_views(screen_name);

CREATE INDEX IF NOT EXISTS idx_screen_views_viewed
ON analytics.screen_views(viewed_at);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date
ON analytics.daily_metrics(metric_date);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_name
ON analytics.daily_metrics(metric_name);

CREATE INDEX IF NOT EXISTS idx_food_metrics_food
ON analytics.food_metrics(food_id);

CREATE INDEX IF NOT EXISTS idx_food_metrics_date
ON analytics.food_metrics(metric_date);

CREATE INDEX IF NOT EXISTS idx_voucher_metrics_voucher
ON analytics.voucher_metrics(voucher_id);

CREATE INDEX IF NOT EXISTS idx_voucher_metrics_date
ON analytics.voucher_metrics(metric_date);

-- =========================================================
-- END MIGRATION 022
-- =========================================================