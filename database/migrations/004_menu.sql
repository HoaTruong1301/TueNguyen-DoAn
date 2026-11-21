-- =========================================================
-- TUỆ NGUYÊN
-- Migration 004
-- Menu / Food / Category
-- =========================================================


-- =========================================================
-- 1. FOOD CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS menu.food_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    slug VARCHAR(180) NOT NULL UNIQUE,

    description TEXT,

    image_url TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);


-- =========================================================
-- 2. FOODS
-- =========================================================

CREATE TABLE IF NOT EXISTS menu.foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category_id UUID NOT NULL,

    name VARCHAR(200) NOT NULL,

    slug VARCHAR(220) NOT NULL UNIQUE,

    description TEXT,

    price NUMERIC(12,2) NOT NULL,

    sale_price NUMERIC(12,2),

    image_url TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'available',

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    preparation_time_minutes INTEGER,

    calories INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT foods_category_fk
        FOREIGN KEY (category_id)
        REFERENCES menu.food_categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT foods_price_check
        CHECK (price >= 0),

    CONSTRAINT foods_sale_price_check
        CHECK (
            sale_price IS NULL
            OR sale_price >= 0
        ),

    CONSTRAINT foods_sale_price_valid_check
        CHECK (
            sale_price IS NULL
            OR sale_price <= price
        ),

    CONSTRAINT foods_status_check
        CHECK (
            status IN (
                'available',
                'unavailable',
                'hidden'
            )
        ),

    CONSTRAINT foods_preparation_time_check
        CHECK (
            preparation_time_minutes IS NULL
            OR preparation_time_minutes >= 0
        ),

    CONSTRAINT foods_calories_check
        CHECK (
            calories IS NULL
            OR calories >= 0
        )
);


-- =========================================================
-- 3. FOOD IMAGES
-- =========================================================

CREATE TABLE IF NOT EXISTS menu.food_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    food_id UUID NOT NULL,

    image_url TEXT NOT NULL,

    alt_text VARCHAR(255),

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT food_images_food_fk
        FOREIGN KEY (food_id)
        REFERENCES menu.foods(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 4. FOOD OPTIONS
-- =========================================================
-- Ví dụ:
-- Size: Nhỏ / Vừa / Lớn
-- Độ cay: Không cay / Vừa / Cay
-- Topping: Trứng / Phô mai / ...
-- =========================================================

CREATE TABLE IF NOT EXISTS menu.food_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    food_id UUID NOT NULL,

    option_group VARCHAR(100) NOT NULL,

    name VARCHAR(150) NOT NULL,

    price_adjustment NUMERIC(12,2) NOT NULL DEFAULT 0,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT food_options_food_fk
        FOREIGN KEY (food_id)
        REFERENCES menu.foods(id)
        ON DELETE CASCADE,

    CONSTRAINT food_options_price_check
        CHECK (
            price_adjustment >= 0
        )
);


-- =========================================================
-- 5. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS food_categories_active_idx
ON menu.food_categories(is_active);

CREATE INDEX IF NOT EXISTS food_categories_sort_idx
ON menu.food_categories(sort_order);


CREATE INDEX IF NOT EXISTS foods_category_idx
ON menu.foods(category_id);

CREATE INDEX IF NOT EXISTS foods_status_idx
ON menu.foods(status);

CREATE INDEX IF NOT EXISTS foods_featured_idx
ON menu.foods(is_featured);

CREATE INDEX IF NOT EXISTS foods_sort_idx
ON menu.foods(sort_order);

CREATE INDEX IF NOT EXISTS foods_created_idx
ON menu.foods(created_at);


CREATE INDEX IF NOT EXISTS food_images_food_idx
ON menu.food_images(food_id);

CREATE INDEX IF NOT EXISTS food_options_food_idx
ON menu.food_options(food_id);

CREATE INDEX IF NOT EXISTS food_options_group_idx
ON menu.food_options(option_group);



-- =========================================================
-- END MIGRATION 004
-- =========================================================