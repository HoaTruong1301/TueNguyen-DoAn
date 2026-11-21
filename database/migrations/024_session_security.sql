-- ============================================================
-- TUỆ NGUYÊN
-- Migration 024 - Session Security & Refresh Token Rotation
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================
-- 1. REFRESH TOKENS
-- Không lưu refresh token dạng plaintext.
-- Chỉ lưu hash.
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    session_id UUID,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    token_family_id UUID NOT NULL,

    parent_token_id UUID,

    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    revoke_reason VARCHAR(100),

    created_ip INET,

    created_user_agent TEXT,

    last_used_ip INET,

    last_used_user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
ON auth.refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session
ON auth.refresh_tokens(session_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
ON auth.refresh_tokens(token_family_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
ON auth.refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
ON auth.refresh_tokens(user_id, expires_at)
WHERE revoked_at IS NULL
  AND used_at IS NULL;


-- ============================================================
-- 2. SESSION SECURITY
-- Theo dõi trạng thái bảo mật của từng phiên đăng nhập
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.session_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL UNIQUE,

    user_id UUID NOT NULL,

    device_id UUID,

    risk_level VARCHAR(20) NOT NULL DEFAULT 'low'
        CHECK (
            risk_level IN (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    is_trusted BOOLEAN NOT NULL DEFAULT FALSE,

    requires_reauthentication BOOLEAN NOT NULL DEFAULT FALSE,

    requires_otp BOOLEAN NOT NULL DEFAULT FALSE,

    ip_address INET,

    country_code VARCHAR(10),

    user_agent TEXT,

    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    revoke_reason VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_security_user
ON auth.session_security(user_id);

CREATE INDEX IF NOT EXISTS idx_session_security_risk
ON auth.session_security(risk_level);

CREATE INDEX IF NOT EXISTS idx_session_security_active
ON auth.session_security(user_id, revoked_at)
WHERE revoked_at IS NULL;


-- ============================================================
-- 3. SESSION EVENTS
-- Nhật ký các hành động liên quan đến session
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID,

    user_id UUID,

    event_type VARCHAR(50) NOT NULL,

    ip_address INET,

    user_agent TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session
ON auth.session_events(session_id);

CREATE INDEX IF NOT EXISTS idx_session_events_user
ON auth.session_events(user_id);

CREATE INDEX IF NOT EXISTS idx_session_events_type
ON auth.session_events(event_type);

CREATE INDEX IF NOT EXISTS idx_session_events_created
ON auth.session_events(created_at);


-- ============================================================
-- 4. PASSWORD RESET TOKENS
-- Token reset password cũng chỉ lưu hash
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    created_ip INET,

    created_user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
ON auth.password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_expires
ON auth.password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_active
ON auth.password_reset_tokens(user_id, expires_at)
WHERE used_at IS NULL
  AND revoked_at IS NULL;


-- ============================================================
-- 5. EMAIL VERIFICATION TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    created_ip INET,

    created_user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user
ON auth.email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires
ON auth.email_verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verification_active
ON auth.email_verification_tokens(user_id, expires_at)
WHERE used_at IS NULL
  AND revoked_at IS NULL;


-- ============================================================
-- 6. LOGIN SECURITY STATE
-- Trạng thái chống brute-force theo tài khoản
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.login_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    failed_attempts INTEGER NOT NULL DEFAULT 0,

    successful_logins INTEGER NOT NULL DEFAULT 0,

    last_failed_at TIMESTAMPTZ,

    last_success_at TIMESTAMPTZ,

    locked_until TIMESTAMPTZ,

    requires_captcha BOOLEAN NOT NULL DEFAULT FALSE,

    requires_otp BOOLEAN NOT NULL DEFAULT FALSE,

    risk_score INTEGER NOT NULL DEFAULT 0
        CHECK (risk_score >= 0 AND risk_score <= 100),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_security_locked
ON auth.login_security(locked_until);

CREATE INDEX IF NOT EXISTS idx_login_security_risk
ON auth.login_security(risk_score);


-- ============================================================
-- 7. DEFAULT SESSION EVENT TYPES
-- Không tạo bảng enum để Backend dễ mở rộng.
-- Các giá trị chuẩn:
--
-- login
-- logout
-- refresh
-- refresh_reuse_detected
-- session_revoked
-- password_changed
-- password_reset
-- email_verified
-- otp_verified
-- device_trusted
-- device_untrusted
-- suspicious_activity
-- ============================================================


-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE auth.refresh_tokens IS
'Hashed refresh tokens with rotation and token-family tracking';

COMMENT ON TABLE auth.session_security IS
'Security state and risk information for authenticated sessions';

COMMENT ON TABLE auth.session_events IS
'Security events related to authentication sessions';

COMMENT ON TABLE auth.password_reset_tokens IS
'Password reset tokens stored only as hashes';

COMMENT ON TABLE auth.email_verification_tokens IS
'Email verification tokens stored only as hashes';

COMMENT ON TABLE auth.login_security IS
'Account-level brute-force protection state';