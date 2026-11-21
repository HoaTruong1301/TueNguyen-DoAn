-- =========================================================
-- TUỆ NGUYÊN
-- Seed 001
-- Default Roles + Permissions
-- =========================================================

-- =========================================================
-- 1. ROLES
-- =========================================================

INSERT INTO admin.roles
    (name, code, description, is_system_role)
VALUES
    (
        'Super Administrator',
        'SUPER_ADMIN',
        'Toàn quyền quản trị hệ thống',
        TRUE
    ),
    (
        'Administrator',
        'ADMIN',
        'Quản trị hệ thống',
        TRUE
    ),
    (
        'Manager',
        'MANAGER',
        'Quản lý vận hành',
        TRUE
    ),
    (
        'Order Manager',
        'ORDER_MANAGER',
        'Quản lý đơn hàng và đặt bàn',
        TRUE
    ),
    (
        'Content Manager',
        'CONTENT_MANAGER',
        'Quản lý nội dung, banner và campaign',
        TRUE
    ),
    (
        'Member Manager',
        'MEMBER_MANAGER',
        'Quản lý thành viên',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;


-- =========================================================
-- 2. PERMISSIONS
-- =========================================================

INSERT INTO admin.permissions
    (name, code, description, module)
VALUES

-- MEMBER
('View Members', 'member.view', 'Xem danh sách thành viên', 'member'),
('View Member Detail', 'member.view_detail', 'Xem chi tiết thành viên', 'member'),
('Edit Members', 'member.edit', 'Chỉnh sửa thành viên', 'member'),
('Block Members', 'member.block', 'Khóa/mở khóa thành viên', 'member'),

-- FOOD
('View Foods', 'food.view', 'Xem món ăn', 'food'),
('Create Foods', 'food.create', 'Tạo món ăn', 'food'),
('Edit Foods', 'food.edit', 'Chỉnh sửa món ăn', 'food'),
('Delete Foods', 'food.delete', 'Xóa món ăn', 'food'),

-- CATEGORY
('View Categories', 'category.view', 'Xem danh mục món ăn', 'category'),
('Create Categories', 'category.create', 'Tạo danh mục', 'category'),
('Edit Categories', 'category.edit', 'Chỉnh sửa danh mục', 'category'),
('Delete Categories', 'category.delete', 'Xóa danh mục', 'category'),

-- RESERVATION
('View Reservations', 'reservation.view', 'Xem đặt bàn', 'reservation'),
('Manage Reservations', 'reservation.manage', 'Quản lý đặt bàn', 'reservation'),

-- ORDER
('View Orders', 'order.view', 'Xem đơn hàng', 'order'),
('View Order Detail', 'order.view_detail', 'Xem chi tiết đơn hàng', 'order'),
('Update Orders', 'order.update', 'Cập nhật trạng thái đơn hàng', 'order'),
('Cancel Orders', 'order.cancel', 'Hủy đơn hàng', 'order'),

-- DELIVERY
('View Deliveries', 'delivery.view', 'Xem giao hàng', 'delivery'),
('Manage Deliveries', 'delivery.manage', 'Quản lý giao hàng', 'delivery'),

-- VOUCHER
('View Vouchers', 'voucher.view', 'Xem voucher', 'voucher'),
('Create Vouchers', 'voucher.create', 'Tạo voucher', 'voucher'),
('Edit Vouchers', 'voucher.edit', 'Chỉnh sửa voucher', 'voucher'),
('Delete Vouchers', 'voucher.delete', 'Xóa voucher', 'voucher'),

-- NOTIFICATION
('View Notifications', 'notification.view', 'Xem thông báo', 'notification'),
('Create Notifications', 'notification.create', 'Tạo thông báo', 'notification'),
('Send Notifications', 'notification.send', 'Gửi thông báo', 'notification'),

-- CMS
('View CMS', 'cms.view', 'Xem nội dung CMS', 'cms'),
('Edit CMS', 'cms.edit', 'Chỉnh sửa nội dung CMS', 'cms'),

-- BANNER
('View Banners', 'banner.view', 'Xem banner', 'banner'),
('Create Banners', 'banner.create', 'Tạo banner', 'banner'),
('Edit Banners', 'banner.edit', 'Chỉnh sửa banner', 'banner'),
('Delete Banners', 'banner.delete', 'Xóa banner', 'banner'),

-- CAMPAIGN
('View Campaigns', 'campaign.view', 'Xem campaign', 'campaign'),
('Create Campaigns', 'campaign.create', 'Tạo campaign', 'campaign'),
('Edit Campaigns', 'campaign.edit', 'Chỉnh sửa campaign', 'campaign'),
('Delete Campaigns', 'campaign.delete', 'Xóa campaign', 'campaign'),

-- BIRTHDAY
('View Birthday Campaigns', 'birthday.view', 'Xem birthday campaign', 'birthday'),
('Manage Birthday Campaigns', 'birthday.manage', 'Quản lý birthday campaign', 'birthday'),

-- ADMIN
('View Admins', 'admin.view', 'Xem tài khoản quản trị', 'admin'),
('Create Admins', 'admin.create', 'Tạo tài khoản quản trị', 'admin'),
('Edit Admins', 'admin.edit', 'Chỉnh sửa tài khoản quản trị', 'admin'),
('Delete Admins', 'admin.delete', 'Xóa tài khoản quản trị', 'admin'),

-- ROLE
('View Roles', 'role.view', 'Xem role', 'role'),
('Create Roles', 'role.create', 'Tạo role', 'role'),
('Edit Roles', 'role.edit', 'Chỉnh sửa role', 'role'),
('Delete Roles', 'role.delete', 'Xóa role', 'role'),

-- AUDIT
('View Audit Logs', 'audit.view', 'Xem audit log', 'audit'),
('View Error Logs', 'error.view', 'Xem error log', 'error'),

-- DASHBOARD
('View Dashboard', 'dashboard.view', 'Xem dashboard', 'dashboard')

ON CONFLICT (code) DO NOTHING;


-- =========================================================
-- 3. SUPER ADMIN → ALL PERMISSIONS
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
CROSS JOIN admin.permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;


-- =========================================================
-- 4. ADMIN → MOST MANAGEMENT PERMISSIONS
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
JOIN admin.permissions p
    ON p.code IN (
        'dashboard.view',

        'member.view',
        'member.view_detail',
        'member.edit',

        'food.view',
        'food.create',
        'food.edit',

        'category.view',
        'category.create',
        'category.edit',

        'reservation.view',
        'reservation.manage',

        'order.view',
        'order.view_detail',
        'order.update',
        'order.cancel',

        'delivery.view',
        'delivery.manage',

        'voucher.view',
        'voucher.create',
        'voucher.edit',

        'notification.view',
        'notification.create',
        'notification.send',

        'cms.view',
        'cms.edit',

        'banner.view',
        'banner.create',
        'banner.edit',

        'campaign.view',
        'campaign.create',
        'campaign.edit',

        'birthday.view',
        'birthday.manage',

        'audit.view',
        'error.view'
    )
WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;


-- =========================================================
-- 5. MANAGER
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
JOIN admin.permissions p
    ON p.code IN (
        'dashboard.view',

        'member.view',
        'member.view_detail',

        'food.view',
        'food.edit',

        'category.view',
        'category.edit',

        'reservation.view',
        'reservation.manage',

        'order.view',
        'order.view_detail',
        'order.update',

        'delivery.view',
        'delivery.manage',

        'voucher.view',
        'voucher.edit',

        'notification.view',

        'banner.view',
        'campaign.view',

        'birthday.view'
    )
WHERE r.code = 'MANAGER'
ON CONFLICT DO NOTHING;


-- =========================================================
-- 6. ORDER MANAGER
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
JOIN admin.permissions p
    ON p.code IN (
        'dashboard.view',

        'reservation.view',
        'reservation.manage',

        'order.view',
        'order.view_detail',
        'order.update',
        'order.cancel',

        'delivery.view',
        'delivery.manage'
    )
WHERE r.code = 'ORDER_MANAGER'
ON CONFLICT DO NOTHING;


-- =========================================================
-- 7. CONTENT MANAGER
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
JOIN admin.permissions p
    ON p.code IN (
        'dashboard.view',

        'food.view',
        'food.create',
        'food.edit',

        'category.view',
        'category.create',
        'category.edit',

        'cms.view',
        'cms.edit',

        'banner.view',
        'banner.create',
        'banner.edit',
        'banner.delete',

        'campaign.view',
        'campaign.create',
        'campaign.edit',
        'campaign.delete',

        'notification.view',
        'notification.create',
        'notification.send'
    )
WHERE r.code = 'CONTENT_MANAGER'
ON CONFLICT DO NOTHING;


-- =========================================================
-- 8. MEMBER MANAGER
-- =========================================================

INSERT INTO admin.role_permissions
    (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM admin.roles r
JOIN admin.permissions p
    ON p.code IN (
        'dashboard.view',

        'member.view',
        'member.view_detail',
        'member.edit',
        'member.block'
    )
WHERE r.code = 'MEMBER_MANAGER'
ON CONFLICT DO NOTHING;


-- =========================================================
-- END SEED 001
-- =========================================================
