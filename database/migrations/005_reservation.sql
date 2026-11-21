-- =========================================================
-- TUỆ NGUYÊN
-- Migration 005
-- Reservation / Booking Table
-- =========================================================


-- =========================================================
-- 1. RESTAURANT TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS reservation.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    table_number VARCHAR(30) NOT NULL UNIQUE,

    name VARCHAR(100),

    capacity INTEGER NOT NULL,

    location VARCHAR(100),

    description TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'available',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT restaurant_tables_capacity_check
        CHECK (capacity > 0),

    CONSTRAINT restaurant_tables_status_check
        CHECK (
            status IN (
                'available',
                'maintenance',
                'inactive'
            )
        )
);


-- =========================================================
-- 2. RESERVATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS reservation.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_code VARCHAR(30) NOT NULL UNIQUE,

    user_id UUID NOT NULL,

    table_id UUID,

    guest_name VARCHAR(150) NOT NULL,

    guest_phone VARCHAR(20) NOT NULL,

    guest_email VARCHAR(255),

    guest_count INTEGER NOT NULL,

    reservation_date DATE NOT NULL,

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    note TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    cancelled_at TIMESTAMPTZ,

    cancelled_reason TEXT,

    confirmed_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reservations_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE RESTRICT,

    CONSTRAINT reservations_table_fk
        FOREIGN KEY (table_id)
        REFERENCES reservation.restaurant_tables(id)
        ON DELETE SET NULL,

    CONSTRAINT reservations_guest_count_check
        CHECK (guest_count > 0),

    CONSTRAINT reservations_time_check
        CHECK (end_time > start_time),

    CONSTRAINT reservations_status_check
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'arrived',
                'completed',
                'cancelled',
                'no_show',
                'rejected'
            )
        )
);


-- =========================================================
-- 3. RESERVATION STATUS HISTORY
-- =========================================================

CREATE TABLE IF NOT EXISTS reservation.reservation_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL,

    old_status VARCHAR(30),

    new_status VARCHAR(30) NOT NULL,

    changed_by UUID,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reservation_status_history_reservation_fk
        FOREIGN KEY (reservation_id)
        REFERENCES reservation.reservations(id)
        ON DELETE CASCADE,

    CONSTRAINT reservation_status_history_user_fk
        FOREIGN KEY (changed_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 4. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS reservations_user_idx
ON reservation.reservations(user_id);

CREATE INDEX IF NOT EXISTS reservations_table_idx
ON reservation.reservations(table_id);

CREATE INDEX IF NOT EXISTS reservations_date_idx
ON reservation.reservations(reservation_date);

CREATE INDEX IF NOT EXISTS reservations_status_idx
ON reservation.reservations(status);

CREATE INDEX IF NOT EXISTS reservations_created_idx
ON reservation.reservations(created_at);

CREATE INDEX IF NOT EXISTS reservation_history_reservation_idx
ON reservation.reservation_status_history(reservation_id);

CREATE INDEX IF NOT EXISTS restaurant_tables_status_idx
ON reservation.restaurant_tables(status);


-- =========================================================
-- 5. PREVENT DOUBLE BOOKING
-- =========================================================

-- PostgreSQL range:
-- [start, end)
--
-- Ví dụ:
-- 18:00 - 19:30
-- 19:30 - 21:00
--
-- Hai khoảng trên không bị xem là trùng nhau.


CREATE EXTENSION IF NOT EXISTS btree_gist;


ALTER TABLE reservation.reservations
ADD CONSTRAINT reservations_no_double_booking
EXCLUDE USING GIST (
    table_id WITH =,
    reservation_date WITH =,
    tsrange(
        reservation_date + start_time,
        reservation_date + end_time,
        '[)'
    ) WITH &&
)
WHERE (
    table_id IS NOT NULL
    AND status IN (
        'pending',
        'confirmed',
        'arrived'
    )
);


-- =========================================================
-- END MIGRATION 005
-- =========================================================