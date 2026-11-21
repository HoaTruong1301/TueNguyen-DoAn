-- =========================================================
-- TUỆ NGUYÊN
-- Migration 002
-- Authentication + Members
-- =========================================================

-- ---------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    phone VARCHAR(20),
    email VARCHAR(255),

    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    phone_verified_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_status_check
        CHECK (status IN (
            'pending',
            'active',
            'blocked',
            'suspended',
            'deleted'
        ))
);

-- Email không phân biệt hoa thường
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
ON auth.users (LOWER(email))
WHERE email IS NOT NULL
  AND deleted_at IS NULL;

-- Một số điện thoại chỉ thuộc một tài khoản đang hoạt động
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
ON auth.users (phone)
WHERE phone IS NOT NULL
  AND deleted_at IS NULL;


-- ---------------------------------------------------------
-- 2. USER PROFILES
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    full_name VARCHAR(150),
    avatar_url TEXT,

    date_of_birth DATE,

    gender VARCHAR(20),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_profiles_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_profiles_gender_check
        CHECK (
            gender IS NULL
            OR gender IN ('male', 'female', 'other')
        )
);


-- ---------------------------------------------------------
-- 3. USER ADDRESSES
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS member.user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    recipient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,

    address_line TEXT NOT NULL,

    ward VARCHAR(150),
    district VARCHAR(150),
    province VARCHAR(150),

    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_addresses_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_addresses_user_idx
ON member.user_addresses(user_id);


-- ---------------------------------------------------------
-- 4. USER SESSIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    refresh_token_hash TEXT NOT NULL UNIQUE,

    device_id VARCHAR(255),
    device_name VARCHAR(255),
    platform VARCHAR(50),

    ip_address INET,
    user_agent TEXT,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx
ON auth.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS user_sessions_expires_idx
ON auth.user_sessions(expires_at);


-- ---------------------------------------------------------
-- 5. OTP VERIFICATIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    phone VARCHAR(20),
    email VARCHAR(255),

    purpose VARCHAR(30) NOT NULL,

    otp_hash TEXT NOT NULL,

    attempts INTEGER NOT NULL DEFAULT 0,

    expires_at TIMESTAMPTZ NOT NULL,

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT otp_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT otp_purpose_check
        CHECK (
            purpose IN (
                'register',
                'login',
                'forgot_password',
                'change_phone',
                'change_email',
                'sensitive_action'
            )
        ),

    CONSTRAINT otp_attempts_check
        CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS otp_user_idx
ON auth.otp_verifications(user_id);

CREATE INDEX IF NOT EXISTS otp_expires_idx
ON auth.otp_verifications(expires_at);


-- ---------------------------------------------------------
-- 6. LOGIN ATTEMPTS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    identifier VARCHAR(255) NOT NULL,

    success BOOLEAN NOT NULL DEFAULT FALSE,

    ip_address INET,

    user_agent TEXT,

    failure_reason VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT login_attempts_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS login_attempts_identifier_idx
ON auth.login_attempts(identifier);

CREATE INDEX IF NOT EXISTS login_attempts_ip_idx
ON auth.login_attempts(ip_address);

CREATE INDEX IF NOT EXISTS login_attempts_created_idx
ON auth.login_attempts(created_at);


-- =========================================================
-- END MIGRATION 002
-- =========================================================


