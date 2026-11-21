-- =========================================================
-- MIGRATION 020: CUSTOMER SUPPORT / SUPPORT TICKETS
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS support;

-- =========================================================
-- 1. SUPPORT TICKETS
-- =========================================================

CREATE TABLE IF NOT EXISTS support.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_code VARCHAR(50) NOT NULL UNIQUE,

    user_id UUID NOT NULL,

    order_id UUID,

    reservation_id UUID,

    category VARCHAR(50) NOT NULL
        CHECK (
            category IN (
                'order',
                'reservation',
                'delivery',
                'payment',
                'voucher',
                'account',
                'food',
                'technical',
                'complaint',
                'suggestion',
                'other'
            )
        ),

    priority VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    subject VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (
            status IN (
                'open',
                'in_progress',
                'waiting_customer',
                'waiting_internal',
                'resolved',
                'closed',
                'cancelled'
            )
        ),

    assigned_admin_id UUID,

    resolved_at TIMESTAMPTZ,

    closed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. TICKET MESSAGES
-- =========================================================

CREATE TABLE IF NOT EXISTS support.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL,

    sender_type VARCHAR(20) NOT NULL
        CHECK (
            sender_type IN (
                'customer',
                'admin',
                'system'
            )
        ),

    sender_user_id UUID,

    message TEXT NOT NULL,

    is_internal BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ticket_messages_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES support.tickets(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 3. TICKET ATTACHMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS support.ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL,

    message_id UUID,

    media_file_id UUID,

    file_name VARCHAR(255),

    file_url TEXT,

    mime_type VARCHAR(100),

    file_size BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ticket_attachments_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES support.tickets(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 4. TICKET STATUS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS support.ticket_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticket_id UUID NOT NULL,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    changed_by UUID,

    changed_by_type VARCHAR(20) NOT NULL DEFAULT 'admin'
        CHECK (
            changed_by_type IN (
                'customer',
                'admin',
                'system'
            )
        ),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ticket_status_history_ticket_fk
        FOREIGN KEY (ticket_id)
        REFERENCES support.tickets(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. TICKET CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS support.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    description TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 6. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
ON support.tickets(user_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_order
ON support.tickets(order_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_reservation
ON support.tickets(reservation_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_category
ON support.tickets(category);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority
ON support.tickets(priority);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
ON support.tickets(status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned
ON support.tickets(assigned_admin_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created
ON support.tickets(created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
ON support.ticket_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender
ON support.ticket_messages(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_created
ON support.ticket_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket
ON support.ticket_attachments(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message
ON support.ticket_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket
ON support.ticket_status_history(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_status_history_created
ON support.ticket_status_history(created_at);

CREATE INDEX IF NOT EXISTS idx_support_categories_active
ON support.categories(is_active);

CREATE INDEX IF NOT EXISTS idx_support_categories_sort
ON support.categories(sort_order);

-- =========================================================
-- 7. DEFAULT SUPPORT CATEGORIES
-- =========================================================

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'order',
    'Đơn hàng',
    'Vấn đề liên quan đến đơn hàng',
    1
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'reservation',
    'Đặt bàn',
    'Vấn đề liên quan đến đặt bàn',
    2
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'delivery',
    'Giao hàng',
    'Vấn đề liên quan đến giao hàng',
    3
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'payment',
    'Thanh toán',
    'Vấn đề liên quan đến thanh toán',
    4
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'voucher',
    'Voucher',
    'Vấn đề liên quan đến voucher',
    5
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'account',
    'Tài khoản',
    'Vấn đề liên quan đến tài khoản',
    6
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'technical',
    'Kỹ thuật',
    'Lỗi ứng dụng hoặc website',
    7
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'complaint',
    'Khiếu nại',
    'Phản ánh hoặc khiếu nại',
    8
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'suggestion',
    'Góp ý',
    'Góp ý cải thiện dịch vụ',
    9
)
ON CONFLICT (code)
DO NOTHING;

INSERT INTO support.categories (
    code,
    name,
    description,
    sort_order
)
VALUES (
    'other',
    'Khác',
    'Các yêu cầu khác',
    10
)
ON CONFLICT (code)
DO NOTHING;

-- =========================================================
-- END MIGRATION 020
-- =========================================================