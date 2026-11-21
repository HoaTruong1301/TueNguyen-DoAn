CREATE TABLE IF NOT EXISTS notification.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    fcm_token TEXT NOT NULL UNIQUE,

    platform VARCHAR(20) NOT NULL DEFAULT 'android',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
    ON notification.device_tokens(user_id);
