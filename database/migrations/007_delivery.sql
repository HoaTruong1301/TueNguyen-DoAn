-- =========================================================
-- MIGRATION 007: DELIVERY
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. DELIVERY ADDRESSES
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery.delivery_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(30) NOT NULL,

    address_line TEXT NOT NULL,
    ward VARCHAR(150),
    district VARCHAR(150),
    city VARCHAR(150),

    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),

    address_label VARCHAR(50),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. DELIVERY ORDERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery.delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL UNIQUE
        REFERENCES orders.customer_orders(id)
        ON DELETE CASCADE,

    delivery_address_id UUID NULL
        REFERENCES delivery.delivery_addresses(id)
        ON DELETE SET NULL,

    -- Snapshot địa chỉ lúc giao hàng
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(30) NOT NULL,

    address_snapshot JSONB NOT NULL,

    -- Trạng thái giao hàng
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'assigned',
                'picked_up',
                'out_for_delivery',
                'delivered',
                'failed',
                'cancelled'
            )
        ),

    -- Người giao hàng
    driver_name VARCHAR(150),
    driver_phone VARCHAR(30),

    -- Phí giao hàng
    delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (delivery_fee >= 0),

    -- Ghi chú giao hàng
    delivery_note TEXT,

    -- Thời gian
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    failure_reason TEXT,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. DELIVERY STATUS HISTORY
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery.delivery_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    delivery_order_id UUID NOT NULL
        REFERENCES delivery.delivery_orders(id)
        ON DELETE CASCADE,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    changed_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. DELIVERY TRACKING
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery.delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    delivery_order_id UUID NOT NULL
        REFERENCES delivery.delivery_orders(id)
        ON DELETE CASCADE,

    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user
ON delivery.delivery_addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_active
ON delivery.delivery_addresses(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_status
ON delivery.delivery_orders(status);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_created
ON delivery.delivery_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_address
ON delivery.delivery_orders(delivery_address_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_order
ON delivery.delivery_status_history(delivery_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_created
ON delivery.delivery_status_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order
ON delivery.delivery_tracking(delivery_order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_recorded
ON delivery.delivery_tracking(recorded_at DESC);

-- ---------------------------------------------------------
-- 6. ONLY ONE DEFAULT ADDRESS PER USER
-- ---------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_default_address_per_user
ON delivery.delivery_addresses(user_id)
WHERE is_default = TRUE
  AND is_active = TRUE;

-- =========================================================
-- END MIGRATION 007
-- =========================================================