-- =========================================================
-- MIGRATION 006: ORDERS
-- Tuệ Nguyên
-- =========================================================

-- ---------------------------------------------------------
-- 1. ORDERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders.customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_code VARCHAR(30) NOT NULL UNIQUE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    reservation_id UUID NULL
        REFERENCES reservation.reservations(id)
        ON DELETE SET NULL,

    -- Loại đơn
    order_type VARCHAR(20) NOT NULL DEFAULT 'delivery'
        CHECK (
            order_type IN (
                'dine_in',
                'pickup',
                'delivery'
            )
        ),

    -- Nguồn tạo đơn
    source VARCHAR(20) NOT NULL DEFAULT 'app'
        CHECK (
            source IN (
                'app',
                'admin'
            )
        ),

    -- Snapshot thông tin khách tại thời điểm đặt hàng
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(255),

    -- Ghi chú của khách
    note TEXT,

    -- Địa chỉ giao hàng tại thời điểm đặt
    delivery_address_snapshot JSONB,

    -- Tiền hàng
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),

    -- Giảm giá từ voucher / chương trình
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (discount_total >= 0),

    -- Phí giao hàng
    delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (delivery_fee >= 0),

    -- Thuế
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (tax_total >= 0),

    -- Tổng tiền cuối cùng
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (grand_total >= 0),

    currency CHAR(3) NOT NULL DEFAULT 'VND',

    -- Trạng thái đơn
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'preparing',
                'ready',
                'out_for_delivery',
                'delivered',
                'completed',
                'cancelled',
                'rejected'
            )
        ),

    -- Lý do huỷ / từ chối
    cancellation_reason TEXT,

    rejected_reason TEXT,

    -- Thời gian
    confirmed_at TIMESTAMPTZ,
    preparing_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 2. ORDER ITEMS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders.customer_orders(id)
        ON DELETE CASCADE,

    -- Có thể NULL nếu món đã bị xoá hoàn toàn
    food_id UUID NULL
        REFERENCES menu.foods(id)
        ON DELETE SET NULL,

    -- Lưu tên món tại thời điểm mua
    food_name_snapshot VARCHAR(255) NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    -- Giá tại thời điểm mua
    unit_price NUMERIC(14,2) NOT NULL
        CHECK (unit_price >= 0),

    -- Giảm giá riêng cho món
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (discount_amount >= 0),

    -- Thành tiền
    line_total NUMERIC(14,2) NOT NULL
        CHECK (line_total >= 0),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. ORDER ITEM OPTIONS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders.order_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_item_id UUID NOT NULL
        REFERENCES orders.order_items(id)
        ON DELETE CASCADE,

    -- Có thể NULL nếu option đã bị xoá
    food_option_id UUID NULL
        REFERENCES menu.food_options(id)
        ON DELETE SET NULL,

    -- Snapshot option tại thời điểm mua
    option_group_snapshot VARCHAR(100) NOT NULL,
    option_name_snapshot VARCHAR(255) NOT NULL,

    price_adjustment NUMERIC(14,2) NOT NULL DEFAULT 0,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 4. PAYMENTS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders.customer_orders(id)
        ON DELETE CASCADE,

    payment_method VARCHAR(30) NOT NULL
        CHECK (
            payment_method IN (
                'cash',
                'card',
                'bank_transfer',
                'e_wallet'
            )
        ),

    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            payment_status IN (
                'unpaid',
                'pending',
                'paid',
                'failed',
                'refunded',
                'partially_refunded'
            )
        ),

    amount NUMERIC(14,2) NOT NULL
        CHECK (amount >= 0),

    currency CHAR(3) NOT NULL DEFAULT 'VND',

    -- Mã giao dịch từ cổng thanh toán
    transaction_id VARCHAR(255),

    -- Tên cổng thanh toán
    provider VARCHAR(100),

    failure_reason TEXT,

    paid_at TIMESTAMPTZ,

    refunded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 5. ORDER STATUS HISTORY
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL
        REFERENCES orders.customer_orders(id)
        ON DELETE CASCADE,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    -- Người thực hiện thay đổi
    changed_by UUID NULL
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 6. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders.customer_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders.customer_orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_type
ON orders.customer_orders(order_type);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders.customer_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_reservation
ON orders.customer_orders(reservation_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON orders.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_food
ON orders.order_items(food_id);

CREATE INDEX IF NOT EXISTS idx_order_item_options_item
ON orders.order_item_options(order_item_id);

CREATE INDEX IF NOT EXISTS idx_payments_order
ON orders.payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON orders.payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
ON orders.order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_created
ON orders.order_status_history(created_at DESC);

-- ---------------------------------------------------------
-- 7. UNIQUE TRANSACTION ID
-- ---------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transaction
ON orders.payments(transaction_id)
WHERE transaction_id IS NOT NULL;

-- =========================================================
-- END MIGRATION 006
-- =========================================================