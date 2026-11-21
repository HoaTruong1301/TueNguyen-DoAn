-- =========================================================
-- MIGRATION 032: GIÁM SÁT HOẠT ĐỘNG NHÂN VIÊN
-- Ghi lại ai giảm giá đơn (huỷ bill đã có ở order_status_history)
-- =========================================================

CREATE TABLE IF NOT EXISTS orders.order_discount_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders.customer_orders(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_discount NUMERIC(14,2) NOT NULL,
    new_discount NUMERIC(14,2) NOT NULL,
    -- Số tiền giảm thêm của lần thao tác này (có thể âm nếu giảm bớt)
    delta NUMERIC(14,2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discount_logs_admin
    ON orders.order_discount_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discount_logs_order
    ON orders.order_discount_logs(order_id);

CREATE INDEX IF NOT EXISTS idx_status_history_cancel
    ON orders.order_status_history(new_status, created_at DESC);

INSERT INTO admin.permissions (name, code, description, module) VALUES
    ('Giảm giá đơn hàng', 'order.discount', 'Giảm giá thủ công cho đơn hàng', 'order'),
    ('Xem giám sát nhân viên', 'staff.audit.view', 'Xem ai huỷ bill, ai giảm giá', 'staff')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND p.code IN ('order.discount', 'staff.audit.view')
ON CONFLICT DO NOTHING;

-- Quản lý đơn hàng được giảm giá (nhưng bị ghi vết)
INSERT INTO admin.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code = 'ORDER_MANAGER' AND p.code = 'order.discount'
ON CONFLICT DO NOTHING;

-- =========================================================
-- BỔ SUNG QUYỀN CÒN THIẾU
-- Code backend đã dùng các mã quyền này nhưng chưa migration/seed nào tạo ra,
-- nên tài khoản không có quyền sẽ bị 403 ở trang nhân viên và chi tiết đơn.
-- =========================================================
INSERT INTO admin.permissions (name, code, description, module) VALUES
    ('Xem chi tiết đơn (admin)', 'order.detail', 'Xem chi tiết đơn hàng trong trang quản trị', 'order'),
    ('Xem nhân viên', 'staff.view', 'Xem danh sách nhân viên', 'staff'),
    ('Tạo nhân viên', 'staff.create', 'Tạo tài khoản nhân viên', 'staff'),
    ('Xem vai trò nhân viên', 'staff.roles.view', 'Xem danh sách vai trò', 'staff'),
    ('Đổi vai trò nhân viên', 'staff.role.edit', 'Đổi vai trò nhân viên', 'staff'),
    ('Khoá/mở nhân viên', 'staff.status.edit', 'Đổi trạng thái nhân viên', 'staff'),
    ('Xem nhật ký nhân viên', 'staff.activity.view', 'Xem nhật ký thao tác quản trị', 'staff')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN ('order.detail','staff.view','staff.create','staff.roles.view',
                 'staff.role.edit','staff.status.edit','staff.activity.view')
ON CONFLICT DO NOTHING;

INSERT INTO admin.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code IN ('ADMIN','MANAGER','ORDER_MANAGER') AND p.code = 'order.detail'
ON CONFLICT DO NOTHING;
