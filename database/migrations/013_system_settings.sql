-- =========================================================
-- MIGRATION 013: SYSTEM SETTINGS & APP CONFIGURATION
-- Tuệ Nguyên
-- =========================================================

-- =========================================================
-- 0. ENSURE SCHEMA
-- =========================================================

CREATE SCHEMA IF NOT EXISTS system;

-- =========================================================
-- 1. SYSTEM SETTINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Mã cấu hình duy nhất
    setting_key VARCHAR(100) NOT NULL UNIQUE,

    -- Giá trị cấu hình
    setting_value TEXT,

    -- Kiểu dữ liệu
    value_type VARCHAR(20) NOT NULL DEFAULT 'string'
        CHECK (
            value_type IN (
                'string',
                'integer',
                'decimal',
                'boolean',
                'json'
            )
        ),

    -- Mô tả
    description TEXT,

    -- Nhóm cấu hình
    category VARCHAR(50) NOT NULL DEFAULT 'general',

    -- Kích hoạt
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Có thể chỉnh sửa từ Admin Web
    is_editable BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. APP CONFIGURATION
-- =========================================================

CREATE TABLE IF NOT EXISTS system.app_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Nền tảng
    platform VARCHAR(20) NOT NULL,

    -- Phiên bản tối thiểu
    min_version VARCHAR(30),

    -- Phiên bản mới nhất
    latest_version VARCHAR(30),

    -- Bắt buộc cập nhật
    force_update BOOLEAN NOT NULL DEFAULT FALSE,

    -- Link cập nhật
    update_url TEXT,

    -- Chế độ bảo trì
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,

    maintenance_message TEXT,

    -- Chức năng hệ thống
    login_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    ordering_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    reservation_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Mỗi nền tảng chỉ có một cấu hình
    CONSTRAINT app_configs_platform_check
        CHECK (
            platform IN (
                'android',
                'ios',
                'web',
                'all'
            )
        ),

    CONSTRAINT app_configs_platform_unique
        UNIQUE (platform)
);

-- =========================================================
-- 3. BUSINESS HOURS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 0 = Chủ nhật
    -- 1 = Thứ 2
    -- 2 = Thứ 3
    -- 3 = Thứ 4
    -- 4 = Thứ 5
    -- 5 = Thứ 6
    -- 6 = Thứ 7
    day_of_week SMALLINT NOT NULL,

    is_open BOOLEAN NOT NULL DEFAULT TRUE,

    open_time TIME,

    close_time TIME,

    -- Ca thứ 2 nếu có
    second_open_time TIME,

    second_close_time TIME,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT business_hours_day_check
        CHECK (
            day_of_week BETWEEN 0 AND 6
        ),

    CONSTRAINT business_hours_time_check
        CHECK (
            is_open = FALSE
            OR (
                open_time IS NOT NULL
                AND close_time IS NOT NULL
            )
        ),

    CONSTRAINT business_hours_second_time_check
        CHECK (
            (
                second_open_time IS NULL
                AND second_close_time IS NULL
            )
            OR (
                second_open_time IS NOT NULL
                AND second_close_time IS NOT NULL
            )
        ),

    CONSTRAINT business_hours_day_unique
        UNIQUE (day_of_week)
);

-- =========================================================
-- 4. CLOSING DAYS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.closing_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    closing_date DATE NOT NULL UNIQUE,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 5. INDEXES - SETTINGS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_system_settings_category
ON system.settings(category);

CREATE INDEX IF NOT EXISTS idx_system_settings_active
ON system.settings(is_active);

CREATE INDEX IF NOT EXISTS idx_system_settings_key
ON system.settings(setting_key);

-- =========================================================
-- 6. INDEXES - APP CONFIG
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_app_configs_platform
ON system.app_configs(platform);

CREATE INDEX IF NOT EXISTS idx_app_configs_maintenance
ON system.app_configs(maintenance_mode);

-- =========================================================
-- 7. INDEXES - BUSINESS HOURS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_business_hours_day
ON system.business_hours(day_of_week);

-- =========================================================
-- 8. INDEXES - CLOSING DAYS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_closing_days_date
ON system.closing_days(closing_date);

CREATE INDEX IF NOT EXISTS idx_closing_days_active
ON system.closing_days(is_active);

-- =========================================================
-- 9. DEFAULT SYSTEM SETTINGS
-- =========================================================

INSERT INTO system.settings (
    setting_key,
    setting_value,
    value_type,
    description,
    category,
    is_active,
    is_editable
)
VALUES
(
    'app.name',
    'Tuệ Nguyên',
    'string',
    'Tên ứng dụng',
    'app',
    TRUE,
    TRUE
),
(
    'business.name',
    'Tuệ Nguyên',
    'string',
    'Tên thương hiệu / nhà hàng',
    'business',
    TRUE,
    TRUE
),
(
    'business.phone',
    '',
    'string',
    'Số điện thoại liên hệ',
    'business',
    TRUE,
    TRUE
),
(
    'business.email',
    '',
    'string',
    'Email liên hệ',
    'business',
    TRUE,
    TRUE
),
(
    'business.address',
    '',
    'string',
    'Địa chỉ nhà hàng',
    'business',
    TRUE,
    TRUE
),
(
    'order.minimum_amount',
    '0',
    'decimal',
    'Giá trị đơn hàng tối thiểu',
    'order',
    TRUE,
    TRUE
),
(
    'delivery.enabled',
    'true',
    'boolean',
    'Cho phép giao hàng',
    'delivery',
    TRUE,
    TRUE
),
(
    'reservation.enabled',
    'true',
    'boolean',
    'Cho phép đặt bàn',
    'reservation',
    TRUE,
    TRUE
),
(
    'voucher.enabled',
    'true',
    'boolean',
    'Cho phép sử dụng voucher',
    'promotion',
    TRUE,
    TRUE
),
(
    'notification.push_enabled',
    'true',
    'boolean',
    'Cho phép gửi Push Notification',
    'notification',
    TRUE,
    TRUE
)
ON CONFLICT (setting_key)
DO NOTHING;

-- =========================================================
-- 10. DEFAULT APP CONFIG
-- =========================================================

INSERT INTO system.app_configs (
    platform,
    min_version,
    latest_version,
    force_update,
    update_url,
    maintenance_mode,
    maintenance_message,
    login_enabled,
    ordering_enabled,
    reservation_enabled,
    delivery_enabled
)
VALUES
(
    'android',
    '1.0.0',
    '1.0.0',
    FALSE,
    NULL,
    FALSE,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (platform)
DO NOTHING;

INSERT INTO system.app_configs (
    platform,
    min_version,
    latest_version,
    force_update,
    update_url,
    maintenance_mode,
    maintenance_message,
    login_enabled,
    ordering_enabled,
    reservation_enabled,
    delivery_enabled
)
VALUES
(
    'ios',
    '1.0.0',
    '1.0.0',
    FALSE,
    NULL,
    FALSE,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (platform)
DO NOTHING;

INSERT INTO system.app_configs (
    platform,
    min_version,
    latest_version,
    force_update,
    update_url,
    maintenance_mode,
    maintenance_message,
    login_enabled,
    ordering_enabled,
    reservation_enabled,
    delivery_enabled
)
VALUES
(
    'web',
    '1.0.0',
    '1.0.0',
    FALSE,
    NULL,
    FALSE,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (platform)
DO NOTHING;

-- =========================================================
-- 11. DEFAULT BUSINESS HOURS
-- =========================================================

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    0,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    1,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    2,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    3,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    4,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    5,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

INSERT INTO system.business_hours (
    day_of_week,
    is_open,
    open_time,
    close_time,
    second_open_time,
    second_close_time
)
VALUES
(
    6,
    TRUE,
    '06:30',
    '22:00',
    NULL,
    NULL
)
ON CONFLICT (day_of_week)
DO NOTHING;

-- =========================================================
-- END MIGRATION 013
-- =========================================================