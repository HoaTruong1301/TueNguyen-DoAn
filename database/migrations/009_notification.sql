-- =========================================================
-- MIGRATION 009: NOTIFICATION
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. NOTIFICATIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- Loại thông báo
    type VARCHAR(50) NOT NULL,

    title VARCHAR(255) NOT NULL,

    content TEXT NOT NULL,

    -- Dữ liệu bổ sung để App xử lý khi bấm thông báo
    data JSONB,

    -- Icon / hình ảnh thông báo
    image_url TEXT,

    -- Trạng thái
    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    read_at TIMESTAMPTZ,

    -- Có thể dùng để sắp xếp / ưu tiên
    priority INTEGER NOT NULL DEFAULT 0,

    -- Thời điểm thông báo có hiệu lực
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. NOTIFICATION DEVICES
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.notification_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- FCM token / APNs token
    device_token TEXT NOT NULL,

    platform VARCHAR(20) NOT NULL
        CHECK (
            platform IN (
                'android',
                'ios',
                'web'
            )
        ),

    device_name VARCHAR(255),

    app_version VARCHAR(50),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_seen_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (device_token)
);

-- ---------------------------------------------------------
-- 3. NOTIFICATION TEMPLATES
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    title_template VARCHAR(255) NOT NULL,

    content_template TEXT NOT NULL,

    -- Có cho phép gửi Push hay không
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Có lưu vào hộp thông báo App hay không
    inbox_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. NOTIFICATION BROADCASTS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    template_id UUID NULL
        REFERENCES notification.notification_templates(id)
        ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,

    content TEXT NOT NULL,

    data JSONB,

    image_url TEXT,

    -- Gửi cho tất cả hoặc nhóm người dùng
    target_type VARCHAR(30) NOT NULL DEFAULT 'all'
        CHECK (
            target_type IN (
                'all',
                'specific_users'
            )
        ),

    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'scheduled',
                'sending',
                'sent',
                'cancelled',
                'failed'
            )
        ),

    scheduled_at TIMESTAMPTZ,

    sent_at TIMESTAMPTZ,

    created_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 5. BROADCAST RECIPIENTS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    broadcast_id UUID NOT NULL
        REFERENCES notification.notification_broadcasts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'sent',
                'failed'
            )
        ),

    sent_at TIMESTAMPTZ,

    failure_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (broadcast_id, user_id)
);

-- ---------------------------------------------------------
-- 6. USER NOTIFICATION SETTINGS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS notification.user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- Thông báo đơn hàng
    order_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- Khuyến mãi / voucher
    promotion_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- Thông báo đặt bàn
    reservation_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- Tin tức / chiến dịch
    campaign_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- Thông báo sinh nhật
    birthday_notifications BOOLEAN NOT NULL DEFAULT TRUE,

    -- Push notification
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id)
);

-- ---------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notification.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
ON notification.notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_published
ON notification.notifications(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
ON notification.notifications(type);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user
ON notification.notification_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_active
ON notification.notification_devices(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_notification_broadcast_status
ON notification.notification_broadcasts(status);

CREATE INDEX IF NOT EXISTS idx_notification_broadcast_schedule
ON notification.notification_broadcasts(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast
ON notification.broadcast_recipients(broadcast_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_user
ON notification.broadcast_recipients(user_id);

-- =========================================================
-- END MIGRATION 009
-- =========================================================