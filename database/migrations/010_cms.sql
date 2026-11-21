-- =========================================================
-- MIGRATION 010: CMS
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. CMS CONTENT
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Mã nội dung dùng trong App
    code VARCHAR(100) NOT NULL UNIQUE,

    title VARCHAR(255) NOT NULL,

    content TEXT NOT NULL,

    -- Loại nội dung
    content_type VARCHAR(30) NOT NULL DEFAULT 'page'
        CHECK (
            content_type IN (
                'page',
                'article',
                'policy',
                'term',
                'announcement'
            )
        ),

    -- Bản nháp / xuất bản
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'published',
                'archived'
            )
        ),

    published_at TIMESTAMPTZ,

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    updated_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. CONTENT VERSIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID NOT NULL
        REFERENCES cms.contents(id)
        ON DELETE CASCADE,

    version_number INTEGER NOT NULL
        CHECK (version_number > 0),

    title VARCHAR(255) NOT NULL,

    content TEXT NOT NULL,

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (content_id, version_number)
);

-- ---------------------------------------------------------
-- 3. BANNERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,

    subtitle VARCHAR(500),

    image_url TEXT NOT NULL,

    mobile_image_url TEXT,

    -- Link khi khách bấm banner
    action_type VARCHAR(30) NOT NULL DEFAULT 'none'
        CHECK (
            action_type IN (
                'none',
                'food',
                'category',
                'voucher',
                'campaign',
                'content',
                'external_url'
            )
        ),

    action_value TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    starts_at TIMESTAMPTZ,

    ends_at TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    updated_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT banners_valid_time
        CHECK (
            ends_at IS NULL
            OR starts_at IS NULL
            OR ends_at > starts_at
        )
);

-- ---------------------------------------------------------
-- 4. CAMPAIGNS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    image_url TEXT,

    content TEXT,

    starts_at TIMESTAMPTZ NOT NULL,

    ends_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'scheduled',
                'active',
                'ended',
                'cancelled'
            )
        ),

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    updated_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT campaigns_valid_time
        CHECK (ends_at > starts_at)
);

-- ---------------------------------------------------------
-- 5. CAMPAIGN VOUCHERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.campaign_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    campaign_id UUID NOT NULL
        REFERENCES cms.campaigns(id)
        ON DELETE CASCADE,

    voucher_id UUID NOT NULL
        REFERENCES promotion.vouchers(id)
        ON DELETE CASCADE,

    UNIQUE (campaign_id, voucher_id)
);

-- ---------------------------------------------------------
-- 6. CAMPAIGN FOODS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms.campaign_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    campaign_id UUID NOT NULL
        REFERENCES cms.campaigns(id)
        ON DELETE CASCADE,

    food_id UUID NOT NULL
        REFERENCES menu.foods(id)
        ON DELETE CASCADE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    UNIQUE (campaign_id, food_id)
);

-- ---------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cms_contents_type
ON cms.contents(content_type);

CREATE INDEX IF NOT EXISTS idx_cms_contents_status
ON cms.contents(status);

CREATE INDEX IF NOT EXISTS idx_cms_contents_published
ON cms.contents(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_versions_content
ON cms.content_versions(content_id);

CREATE INDEX IF NOT EXISTS idx_banners_active
ON cms.banners(is_active);

CREATE INDEX IF NOT EXISTS idx_banners_sort
ON cms.banners(sort_order);

CREATE INDEX IF NOT EXISTS idx_banners_time
ON cms.banners(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
ON cms.campaigns(status);

CREATE INDEX IF NOT EXISTS idx_campaigns_time
ON cms.campaigns(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_campaign_vouchers_campaign
ON cms.campaign_vouchers(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_vouchers_voucher
ON cms.campaign_vouchers(voucher_id);

CREATE INDEX IF NOT EXISTS idx_campaign_foods_campaign
ON cms.campaign_foods(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_foods_food
ON cms.campaign_foods(food_id);

-- =========================================================
-- END MIGRATION 010
-- =========================================================