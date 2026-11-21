-- =========================================================
-- MIGRATION 012: AUDIT LOG & ERROR LOG
-- Tuệ Nguyên
-- =========================================================

-- =========================================================
-- 0. ENSURE SCHEMA
-- =========================================================

CREATE SCHEMA IF NOT EXISTS system;

-- =========================================================
-- 1. AUDIT LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Người dùng thực hiện thao tác
    user_id UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    -- Admin thực hiện thao tác
    admin_user_id UUID NULL
        REFERENCES admin.admin_users(id)
        ON DELETE SET NULL,

    -- Loại thao tác
    action VARCHAR(50) NOT NULL,

    -- Đối tượng bị tác động
    entity_type VARCHAR(100),
    entity_id UUID,

    -- Dữ liệu trước và sau khi thay đổi
    old_data JSONB,
    new_data JSONB,

    -- Thông tin truy cập
    ip_address INET,
    user_agent TEXT,

    -- Request ID để truy vết Backend
    request_id VARCHAR(100),

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. ERROR LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Mức độ lỗi
    level VARCHAR(20) NOT NULL DEFAULT 'error'
        CHECK (
            level IN (
                'debug',
                'info',
                'warning',
                'error',
                'critical'
            )
        ),

    -- Mã lỗi hệ thống
    error_code VARCHAR(100),

    -- Nội dung lỗi
    message TEXT NOT NULL,

    -- Chi tiết lỗi
    stack_trace TEXT,

    -- Dữ liệu bổ sung
    details JSONB,

    -- API liên quan
    request_id VARCHAR(100),
    method VARCHAR(10),
    endpoint TEXT,
    status_code INTEGER,

    -- Người dùng gặp lỗi
    user_id UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    -- Admin gặp lỗi
    admin_user_id UUID NULL
        REFERENCES admin.admin_users(id)
        ON DELETE SET NULL,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. SECURITY EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    admin_user_id UUID NULL
        REFERENCES admin.admin_users(id)
        ON DELETE SET NULL,

    -- Ví dụ:
    -- login_failed
    -- login_success
    -- otp_failed
    -- otp_expired
    -- password_changed
    -- account_blocked
    -- suspicious_request
    event_type VARCHAR(50) NOT NULL,

    severity VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (
            severity IN (
                'info',
                'warning',
                'high',
                'critical'
            )
        ),

    description TEXT,

    ip_address INET,

    user_agent TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. API REQUEST LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id VARCHAR(100),

    user_id UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    method VARCHAR(10) NOT NULL,

    endpoint TEXT NOT NULL,

    status_code INTEGER,

    response_time_ms INTEGER,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 5. INDEXES - AUDIT LOGS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON system.audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin
ON system.audit_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON system.audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON system.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON system.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request
ON system.audit_logs(request_id);

-- =========================================================
-- 6. INDEXES - ERROR LOGS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_error_logs_level
ON system.error_logs(level);

CREATE INDEX IF NOT EXISTS idx_error_logs_code
ON system.error_logs(error_code);

CREATE INDEX IF NOT EXISTS idx_error_logs_status
ON system.error_logs(status_code);

CREATE INDEX IF NOT EXISTS idx_error_logs_user
ON system.error_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_admin
ON system.error_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_created
ON system.error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_request
ON system.error_logs(request_id);

-- =========================================================
-- 7. INDEXES - SECURITY EVENTS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_security_events_user
ON system.security_events(user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_admin
ON system.security_events(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_type
ON system.security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_severity
ON system.security_events(severity);

CREATE INDEX IF NOT EXISTS idx_security_events_created
ON system.security_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_ip
ON system.security_events(ip_address);

-- =========================================================
-- 8. INDEXES - API REQUEST LOGS
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_api_request_logs_request
ON system.api_request_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_user
ON system.api_request_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_endpoint
ON system.api_request_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_status
ON system.api_request_logs(status_code);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created
ON system.api_request_logs(created_at DESC);

-- =========================================================
-- END MIGRATION 012
-- =========================================================