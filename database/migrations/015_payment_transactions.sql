-- =========================================================
-- MIGRATION 015: PAYMENT & TRANSACTIONS
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS payment;

-- =========================================================
-- 1. PAYMENT TRANSACTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS payment.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID,

    user_id UUID,

    transaction_code VARCHAR(100) NOT NULL UNIQUE,

    provider VARCHAR(50) NOT NULL DEFAULT 'internal'
        CHECK (
            provider IN (
                'internal',
                'cash',
                'bank_transfer',
                'momo',
                'vnpay',
                'zalopay',
                'stripe'
            )
        ),

    transaction_type VARCHAR(30) NOT NULL
        CHECK (
            transaction_type IN (
                'payment',
                'refund',
                'partial_refund',
                'deposit',
                'adjustment'
            )
        ),

    amount NUMERIC(15,2) NOT NULL
        CHECK (amount >= 0),

    currency VARCHAR(10) NOT NULL DEFAULT 'VND',

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'success',
                'failed',
                'cancelled',
                'refunded',
                'partially_refunded'
            )
        ),

    provider_transaction_id VARCHAR(255),

    provider_reference VARCHAR(255),

    payment_method VARCHAR(50),

    description TEXT,

    metadata JSONB,

    paid_at TIMESTAMPTZ,

    expired_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. PAYMENT REFUNDS
-- =========================================================

CREATE TABLE IF NOT EXISTS payment.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL,

    order_id UUID,

    refund_code VARCHAR(100) NOT NULL UNIQUE,

    amount NUMERIC(15,2) NOT NULL
        CHECK (amount > 0),

    reason TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'success',
                'failed',
                'cancelled'
            )
        ),

    provider_refund_id VARCHAR(255),

    requested_by UUID,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT refunds_transaction_fk
        FOREIGN KEY (transaction_id)
        REFERENCES payment.transactions(id)
        ON DELETE RESTRICT
);

-- =========================================================
-- 3. PAYMENT WEBHOOK EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS payment.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider VARCHAR(50) NOT NULL,

    event_id VARCHAR(255) NOT NULL,

    event_type VARCHAR(100),

    transaction_id UUID,

    payload JSONB NOT NULL,

    signature TEXT,

    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,

    processing_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            processing_status IN (
                'pending',
                'processing',
                'processed',
                'failed',
                'ignored'
            )
        ),

    error_message TEXT,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT webhook_provider_event_unique
        UNIQUE (
            provider,
            event_id
        )
);

-- =========================================================
-- 4. PAYMENT STATUS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS payment.transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    reason TEXT,

    changed_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transaction_status_history_fk
        FOREIGN KEY (transaction_id)
        REFERENCES payment.transactions(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. PAYMENT METHODS
-- =========================================================

CREATE TABLE IF NOT EXISTS payment.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    provider VARCHAR(50),

    is_online BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 6. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order
ON payment.transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user
ON payment.transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
ON payment.transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider
ON payment.transactions(provider);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_created
ON payment.transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id
ON payment.transactions(provider_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction
ON payment.refunds(transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order
ON payment.refunds(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_status
ON payment.refunds(status);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_provider
ON payment.webhook_events(provider);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_status
ON payment.webhook_events(processing_status);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_received
ON payment.webhook_events(received_at);

CREATE INDEX IF NOT EXISTS idx_transaction_history_transaction
ON payment.transaction_status_history(transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_active
ON payment.payment_methods(is_active);

-- =========================================================
-- 7. DEFAULT PAYMENT METHODS
-- =========================================================

INSERT INTO payment.payment_methods (
    code,
    name,
    description,
    provider,
    is_online,
    is_active,
    sort_order
)
VALUES (
    'cash',
    'Tiền mặt',
    'Thanh toán tiền mặt tại nhà hàng hoặc khi nhận hàng',
    'cash',
    FALSE,
    TRUE,
    1
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO payment.payment_methods (
    code,
    name,
    description,
    provider,
    is_online,
    is_active,
    sort_order
)
VALUES (
    'bank_transfer',
    'Chuyển khoản ngân hàng',
    'Thanh toán bằng chuyển khoản ngân hàng',
    'bank_transfer',
    TRUE,
    TRUE,
    2
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO payment.payment_methods (
    code,
    name,
    description,
    provider,
    is_online,
    is_active,
    sort_order
)
VALUES (
    'momo',
    'MoMo',
    'Thanh toán qua ví MoMo',
    'momo',
    TRUE,
    TRUE,
    3
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO payment.payment_methods (
    code,
    name,
    description,
    provider,
    is_online,
    is_active,
    sort_order
)
VALUES (
    'vnpay',
    'VNPay',
    'Thanh toán qua VNPay',
    'vnpay',
    TRUE,
    TRUE,
    4
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO payment.payment_methods (
    code,
    name,
    description,
    provider,
    is_online,
    is_active,
    sort_order
)
VALUES (
    'zalopay',
    'ZaloPay',
    'Thanh toán qua ZaloPay',
    'zalopay',
    TRUE,
    TRUE,
    5
)
ON CONFLICT (code)
DO NOTHING;

-- =========================================================
-- END MIGRATION 015
-- =========================================================