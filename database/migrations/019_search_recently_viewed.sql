-- =========================================================
-- MIGRATION 019: SEARCH HISTORY & RECENTLY VIEWED
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS member;

-- =========================================================
-- 1. SEARCH HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS member.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    search_keyword VARCHAR(255) NOT NULL,

    normalized_keyword VARCHAR(255),

    search_type VARCHAR(30) NOT NULL DEFAULT 'food'
        CHECK (
            search_type IN (
                'food',
                'category',
                'all'
            )
        ),

    result_count INTEGER NOT NULL DEFAULT 0
        CHECK (result_count >= 0),

    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. RECENTLY VIEWED FOODS
-- =========================================================

CREATE TABLE IF NOT EXISTS member.recently_viewed_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    food_id UUID NOT NULL,

    view_count INTEGER NOT NULL DEFAULT 1
        CHECK (view_count >= 1),

    first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT recently_viewed_foods_unique
        UNIQUE (
            user_id,
            food_id
        )
);

-- =========================================================
-- 3. RECENTLY VIEWED CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS member.recently_viewed_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    category_id UUID NOT NULL,

    view_count INTEGER NOT NULL DEFAULT 1
        CHECK (view_count >= 1),

    first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT recently_viewed_categories_unique
        UNIQUE (
            user_id,
            category_id
        )
);

-- =========================================================
-- 4. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_search_history_user
ON member.search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_keyword
ON member.search_history(normalized_keyword);

CREATE INDEX IF NOT EXISTS idx_search_history_searched
ON member.search_history(searched_at);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_foods_user
ON member.recently_viewed_foods(user_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_foods_food
ON member.recently_viewed_foods(food_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_foods_last_viewed
ON member.recently_viewed_foods(last_viewed_at);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_categories_user
ON member.recently_viewed_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_categories_category
ON member.recently_viewed_categories(category_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_categories_last_viewed
ON member.recently_viewed_categories(last_viewed_at);

-- =========================================================
-- END MIGRATION 019
-- =========================================================