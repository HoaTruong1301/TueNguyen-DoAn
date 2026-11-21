-- =========================================================
-- MIGRATION 016: SECURITY, API KEYS, RATE LIMIT & ANTI-BOT
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS security;

-- =========================================================
-- 1. API KEYS
-- Dùng cho các service nội bộ / admin / integration.
-- Không lưu API key dạng plain text.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    key_prefix VARCHAR(20) NOT NULL,

    key_hash VARCHAR(255) NOT NULL UNIQUE,

    description TEXT,

    environment VARCHAR(20) NOT NULL DEFAULT 'production'
        CHECK (
            environment IN (
                'development',
                'staging',
                'production'
            )
        ),

    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,

    expires_at TIMESTAMPTZ,

    last_used_at TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. RATE LIMIT BUCKETS
-- Lưu trạng thái giới hạn request.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.rate_limit_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    identifier VARCHAR(255) NOT NULL,

    identifier_type VARCHAR(30) NOT NULL
        CHECK (
            identifier_type IN (
                'ip',
                'user',
                'device',
                'api_key',
                'endpoint'
            )
        ),

    endpoint VARCHAR(255),

    request_count INTEGER NOT NULL DEFAULT 0
        CHECK (request_count >= 0),

    window_start TIMESTAMPTZ NOT NULL,

    window_end TIMESTAMPTZ NOT NULL,

    blocked_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rate_limit_window_check
        CHECK (window_end > window_start)
);

-- =========================================================
-- 3. SECURITY CHALLENGES
-- CAPTCHA / anti-bot challenge / verification challenge.
-- Không lưu plaintext challenge nếu không cần thiết.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    challenge_type VARCHAR(30) NOT NULL
        CHECK (
            challenge_type IN (
                'captcha',
                'turnstile',
                'recaptcha',
                'otp',
                'email_verification',
                'device_verification'
            )
        ),

    target VARCHAR(255),

    challenge_hash VARCHAR(255),

    provider VARCHAR(50),

    ip_address INET,

    user_agent TEXT,

    device_id VARCHAR(255),

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    max_attempts INTEGER NOT NULL DEFAULT 5
        CHECK (max_attempts > 0),

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'verified',
                'failed',
                'expired',
                'blocked'
            )
        ),

    expires_at TIMESTAMPTZ NOT NULL,

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. BLOCKED IDENTIFIERS
-- IP / device / account có hành vi nguy hiểm.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.blocked_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    identifier VARCHAR(255) NOT NULL,

    identifier_type VARCHAR(30) NOT NULL
        CHECK (
            identifier_type IN (
                'ip',
                'user',
                'device',
                'email',
                'phone'
            )
        ),

    reason VARCHAR(255),

    details TEXT,

    blocked_until TIMESTAMPTZ,

    is_permanent BOOLEAN NOT NULL DEFAULT FALSE,

    created_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT blocked_identifier_unique
        UNIQUE (
            identifier,
            identifier_type
        )
);

-- =========================================================
-- 5. DEVICE SECURITY
-- Theo dõi thiết bị đăng nhập.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    device_id VARCHAR(255) NOT NULL,

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

    device_name VARCHAR(255),

    app_version VARCHAR(50),

    os_version VARCHAR(100),

    ip_address INET,

    user_agent TEXT,

    is_trusted BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_devices_unique
        UNIQUE (
            user_id,
            device_id
        )
);

-- =========================================================
-- 6. SECURITY EVENTS
-- Chi tiết sự kiện bảo mật.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

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

    device_id VARCHAR(255),

    endpoint VARCHAR(255),

    method VARCHAR(20),

    success BOOLEAN NOT NULL DEFAULT TRUE,

    reason TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 7. LOGIN SECURITY TRACKING
-- Theo dõi brute force / credential stuffing.
-- =========================================================

CREATE TABLE IF NOT EXISTS security.login_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    identifier VARCHAR(255) NOT NULL,

    identifier_type VARCHAR(20) NOT NULL
        CHECK (
            identifier_type IN (
                'email',
                'phone',
                'username',
                'user_id'
            )
        ),

    ip_address INET,

    failed_attempts INTEGER NOT NULL DEFAULT 0
        CHECK (failed_attempts >= 0),

    successful_attempts INTEGER NOT NULL DEFAULT 0
        CHECK (successful_attempts >= 0),

    first_failed_at TIMESTAMPTZ,

    last_failed_at TIMESTAMPTZ,

    locked_until TIMESTAMPTZ,

    is_locked BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT login_security_unique
        UNIQUE (
            identifier,
            identifier_type
        )
);

-- =========================================================
-- 8. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_security_api_keys_active
ON security.api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_security_api_keys_environment
ON security.api_keys(environment);

CREATE INDEX IF NOT EXISTS idx_security_api_keys_expires
ON security.api_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier
ON security.rate_limit_buckets(
    identifier,
    identifier_type
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint
ON security.rate_limit_buckets(endpoint);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window
ON security.rate_limit_buckets(window_end);

CREATE INDEX IF NOT EXISTS idx_challenges_status
ON security.challenges(status);

CREATE INDEX IF NOT EXISTS idx_challenges_expires
ON security.challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_challenges_ip
ON security.challenges(ip_address);

CREATE INDEX IF NOT EXISTS idx_blocked_identifiers_lookup
ON security.blocked_identifiers(
    identifier,
    identifier_type
);

CREATE INDEX IF NOT EXISTS idx_blocked_identifiers_until
ON security.blocked_identifiers(blocked_until);

CREATE INDEX IF NOT EXISTS idx_user_devices_user
ON security.user_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_user_devices_device
ON security.user_devices(device_id);

CREATE INDEX IF NOT EXISTS idx_user_devices_active
ON security.user_devices(is_active);

CREATE INDEX IF NOT EXISTS idx_security_events_user
ON security.security_events(user_id);

CREATE INDEX IF NOT EXISTS idx_security_events_type
ON security.security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_severity
ON security.security_events(severity);

CREATE INDEX IF NOT EXISTS idx_security_events_ip
ON security.security_events(ip_address);

CREATE INDEX IF NOT EXISTS idx_security_events_created
ON security.security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_login_security_identifier
ON security.login_security(
    identifier,
    identifier_type
);

CREATE INDEX IF NOT EXISTS idx_login_security_locked
ON security.login_security(is_locked);

-- =========================================================
-- END MIGRATION 016
-- =========================================================