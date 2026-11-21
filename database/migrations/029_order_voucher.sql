
-- =========================================================
-- MIGRATION 029: ORDER VOUCHER INTEGRATION
-- =========================================================

ALTER TABLE orders.customer_orders
ADD COLUMN IF NOT EXISTS voucher_id UUID
    REFERENCES promotion.vouchers(id)
    ON DELETE SET NULL;

ALTER TABLE orders.customer_orders
ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customer_orders_voucher_id
ON orders.customer_orders(voucher_id);

-- =========================================================
-- END MIGRATION 029
-- =========================================================
