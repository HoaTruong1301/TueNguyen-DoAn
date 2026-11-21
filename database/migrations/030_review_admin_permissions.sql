
BEGIN;

-- Thêm quyền xem và quản lý đánh giá
INSERT INTO admin.permissions (
    name,
    code,
    description,
    module
)
VALUES
(
    'Xem đánh giá',
    'review.view',
    'Xem danh sách, chi tiết và thống kê đánh giá của khách hàng',
    'review'
),
(
    'Quản lý đánh giá',
    'review.manage',
    'Duyệt, từ chối và ẩn đánh giá của khách hàng',
    'review'
)
ON CONFLICT (code) DO NOTHING;

-- Gán hai quyền cho role admin
INSERT INTO admin.role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code IN ('ADMIN', 'SUPER_ADMIN')
  AND p.code IN ('review.view', 'review.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
