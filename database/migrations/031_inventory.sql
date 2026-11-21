-- =========================================================
-- MIGRATION 031: INVENTORY (TỒN KHO)
-- Kho, nguyên liệu, công thức món, nhập/đặt hàng,
-- điều chuyển, huỷ hàng, lịch sử biến động kho.
-- Công thức mẫu ở đây là dữ liệu minh hoạ tự soạn cho đồ án.
-- =========================================================

CREATE SCHEMA IF NOT EXISTS inventory;

-- 1. KHO
CREATE TABLE IF NOT EXISTS inventory.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    -- Kho bị trừ khi bán hàng (bấm bill)
    is_sales_warehouse BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. NGUYÊN LIỆU / VẬT TƯ
CREATE TABLE IF NOT EXISTS inventory.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    category VARCHAR(60),
    min_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    last_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (last_cost >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TỒN HIỆN TẠI THEO KHO
CREATE TABLE IF NOT EXISTS inventory.stock (
    warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory.items(id) ON DELETE CASCADE,
    quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (warehouse_id, item_id)
);

-- 4. CÔNG THỨC MÓN (định lượng nguyên liệu cho 1 phần món)
CREATE TABLE IF NOT EXISTS inventory.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id UUID NOT NULL REFERENCES menu.foods(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory.items(id) ON DELETE RESTRICT,
    quantity_per_serving NUMERIC(14,4) NOT NULL CHECK (quantity_per_serving > 0),
    UNIQUE (food_id, item_id)
);

-- 5. SỔ BIẾN ĐỘNG KHO (mọi thay đổi tồn đều ghi ở đây)
CREATE TABLE IF NOT EXISTS inventory.movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id),
    item_id UUID NOT NULL REFERENCES inventory.items(id),
    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN (
            'purchase_in', 'sale_out', 'transfer_out',
            'transfer_in', 'waste', 'adjust'
        )),
    -- Số lượng có dấu: + nhập vào kho, - xuất khỏi kho
    quantity NUMERIC(14,3) NOT NULL,
    balance_after NUMERIC(14,3) NOT NULL,
    ref_type VARCHAR(30),
    ref_id UUID,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory.movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref ON inventory.movements(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type ON inventory.movements(movement_type, created_at DESC);

-- 6. ĐƠN ĐẶT HÀNG NHÀ CUNG CẤP
CREATE TABLE IF NOT EXISTS inventory.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_code VARCHAR(30) NOT NULL UNIQUE,
    supplier_name VARCHAR(160) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ordered'
        CHECK (status IN ('ordered', 'received', 'cancelled')),
    note TEXT,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES inventory.purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory.items(id),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0)
);

-- 7. ĐIỀU CHUYỂN GIỮA CÁC KHO
CREATE TABLE IF NOT EXISTS inventory.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_code VARCHAR(30) NOT NULL UNIQUE,
    from_warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id),
    to_warehouse_id UUID NOT NULL REFERENCES inventory.warehouses(id),
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory.transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES inventory.transfers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory.items(id),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0)
);

-- 8. Đánh dấu đơn đã trừ kho (chống trừ 2 lần)
ALTER TABLE orders.customer_orders
    ADD COLUMN IF NOT EXISTS inventory_deducted_at TIMESTAMPTZ;

-- =========================================================
-- DỮ LIỆU MẪU
-- =========================================================
INSERT INTO inventory.warehouses (code, name, is_sales_warehouse) VALUES
    ('KHO_TONG', 'Kho tổng', FALSE),
    ('BEP', 'Kho bếp', TRUE),
    ('QUAY', 'Kho quầy', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory.items (sku, name, unit, category, min_stock, last_cost) VALUES
    ('GAO',   'Gạo tẻ',            'kg',   'Tinh bột', 10, 18000),
    ('BUN',   'Bún tươi',          'kg',   'Tinh bột',  5, 16000),
    ('DAUHU', 'Đậu hũ',            'kg',   'Đạm chay',  3, 30000),
    ('NAMRO', 'Nấm rơm',           'kg',   'Nấm',       3, 80000),
    ('NAMDC', 'Nấm đông cô',       'kg',   'Nấm',       2, 150000),
    ('RAUXL', 'Rau xà lách',       'kg',   'Rau củ',    3, 25000),
    ('CAROT', 'Cà rốt',            'kg',   'Rau củ',    3, 20000),
    ('DAUAN', 'Dầu ăn',            'lít',  'Gia vị',    3, 45000),
    ('NTUONG','Nước tương',        'lít',  'Gia vị',    2, 35000),
    ('BOTCG', 'Bột chiên giòn',    'kg',   'Khô',       2, 40000),
    ('TRA',   'Trà túi lọc',       'gói',  'Đồ uống',  20, 1500),
    ('DUONG', 'Đường',             'kg',   'Gia vị',    3, 22000),
    ('HOP',   'Hộp giao hàng',     'cái',  'Bao bì',   50, 1200)
ON CONFLICT (sku) DO NOTHING;

-- Tồn đầu kỳ mẫu cho kho bếp
INSERT INTO inventory.stock (warehouse_id, item_id, quantity)
SELECT w.id, i.id, 20
FROM inventory.warehouses w
CROSS JOIN inventory.items i
WHERE w.code = 'BEP'
ON CONFLICT DO NOTHING;

-- Công thức mẫu: gán theo từ khoá trong tên món (nếu món tồn tại).
-- Định lượng là số tự đặt cho đồ án, không phải công thức thật.
INSERT INTO inventory.recipes (food_id, item_id, quantity_per_serving)
SELECT f.id, i.id, v.qty
FROM menu.foods f
JOIN (VALUES
    ('cơm',   'GAO',    0.15),
    ('cơm',   'RAUXL',  0.05),
    ('bún',   'BUN',    0.20),
    ('bún',   'DAUHU',  0.08),
    ('nấm',   'NAMRO',  0.10),
    ('gỏi',   'CAROT',  0.08),
    ('gỏi',   'RAUXL',  0.08),
    ('chiên', 'BOTCG',  0.05),
    ('chiên', 'DAUAN',  0.03),
    ('trà',   'TRA',    1.00),
    ('trà',   'DUONG',  0.01)
) AS v(keyword, sku, qty)
    ON f.name ILIKE '%' || v.keyword || '%'
JOIN inventory.items i ON i.sku = v.sku
WHERE f.deleted_at IS NULL
ON CONFLICT (food_id, item_id) DO NOTHING;

-- =========================================================
-- QUYỀN
-- =========================================================
INSERT INTO admin.permissions (name, code, description, module) VALUES
    ('Xem tồn kho', 'inventory.view', 'Xem tồn kho và lịch sử kho', 'inventory'),
    ('Quản lý kho', 'inventory.manage', 'Nhập hàng, đặt hàng, điều chuyển, huỷ hàng, sửa công thức', 'inventory')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND p.code IN ('inventory.view', 'inventory.manage')
ON CONFLICT DO NOTHING;
