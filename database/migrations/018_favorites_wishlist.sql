-- =========================================================
-- MIGRATION 018: FAVORITES / WISHLIST
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS member;

-- =========================================================
-- 1. FAVORITE FOODS
-- =========================================================

CREATE TABLE IF NOT EXISTS member.favorite_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    food_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favorite_foods_unique
        UNIQUE (
            user_id,
            food_id
        )
);

-- =========================================================
-- 2. FAVORITE CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS member.favorite_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    category_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favorite_categories_unique
        UNIQUE (
            user_id,
            category_id
        )
);

-- =========================================================
-- 3. FAVORITE CAMPAIGNS
-- =========================================================

CREATE TABLE IF NOT EXISTS member.favorite_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    campaign_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT favorite_campaigns_unique
        UNIQUE (
            user_id,
            campaign_id
        )
);

-- =========================================================
-- 4. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_favorite_foods_user
ON member.favorite_foods(user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_foods_food
ON member.favorite_foods(food_id);

CREATE INDEX IF NOT EXISTS idx_favorite_foods_created
ON member.favorite_foods(created_at);

CREATE INDEX IF NOT EXISTS idx_favorite_categories_user
ON member.favorite_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_categories_category
ON member.favorite_categories(category_id);

CREATE INDEX IF NOT EXISTS idx_favorite_campaigns_user
ON member.favorite_campaigns(user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_campaigns_campaign
ON member.favorite_campaigns(campaign_id);

-- =========================================================
-- END MIGRATION 018
-- =========================================================