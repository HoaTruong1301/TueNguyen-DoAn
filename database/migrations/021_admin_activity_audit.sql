-- =========================================================
-- MIGRATION 021: ADMIN ACTIVITY & DATA CHANGE AUDIT
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS admin;

CREATE SCHEMA IF NOT EXISTS system;

-- =========================================================
-- 1. ADMIN ACTIVITY LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_user_id UUID,

    action VARCHAR(50) NOT NULL,

    module VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    description TEXT,

    ip_address INET,

    user_agent TEXT,

    request_id UUID,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. DATA CHANGE LOG
-- Lưu dữ liệu trước/sau khi thay đổi.
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.data_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_user_id UUID,

    action VARCHAR(30) NOT NULL
        CHECK (
            action IN (
                'create',
                'update',
                'delete',
                'restore',
                'approve',
                'reject',
                'publish',
                'unpublish'
            )
        ),

    schema_name VARCHAR(100) NOT NULL,

    table_name VARCHAR(100) NOT NULL,

    record_id UUID,

    old_data JSONB,

    new_data JSONB,

    changed_fields JSONB,

    reason TEXT,

    request_id UUID,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. ADMIN LOGIN ACTIVITY
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.login_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_user_id UUID,

    email VARCHAR(255),

    action VARCHAR(30) NOT NULL
        CHECK (
            action IN (
                'login_success',
                'login_failed',
                'logout',
                'password_changed',
                'password_reset',
                'mfa_success',
                'mfa_failed',
                'account_locked',
                'account_unlocked'
            )
        ),

    ip_address INET,

    user_agent TEXT,

    device_id VARCHAR(255),

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. ADMIN SECURITY EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.security_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admin_user_id UUID,

    event_type VARCHAR(100) NOT NULL,

    severity VARCHAR(20) NOT NULL DEFAULT 'info'
        CHECK (
            severity IN (
                'info',
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    ip_address INET,

    user_agent TEXT,

    description TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 5. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin
ON admin.activity_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_action
ON admin.activity_logs(action);

CREATE INDEX IF NOT EXISTS idx_admin_activity_module
ON admin.activity_logs(module);

CREATE INDEX IF NOT EXISTS idx_admin_activity_entity
ON admin.activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created
ON admin.activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_data_change_admin
ON admin.data_change_logs(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_data_change_table
ON admin.data_change_logs(schema_name, table_name);

CREATE INDEX IF NOT EXISTS idx_admin_data_change_record
ON admin.data_change_logs(record_id);

CREATE INDEX IF NOT EXISTS idx_admin_data_change_action
ON admin.data_change_logs(action);

CREATE INDEX IF NOT EXISTS idx_admin_data_change_created
ON admin.data_change_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_admin
ON admin.login_activity(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_login_email
ON admin.login_activity(email);

CREATE INDEX IF NOT EXISTS idx_admin_login_action
ON admin.login_activity(action);

CREATE INDEX IF NOT EXISTS idx_admin_login_created
ON admin.login_activity(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_security_admin
ON admin.security_activity(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_security_type
ON admin.security_activity(event_type);

CREATE INDEX IF NOT EXISTS idx_admin_security_severity
ON admin.security_activity(severity);

CREATE INDEX IF NOT EXISTS idx_admin_security_created
ON admin.security_activity(created_at);

-- =========================================================
-- END MIGRATION 021
-- =========================================================