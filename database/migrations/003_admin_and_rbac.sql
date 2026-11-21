-- =========================================================
-- TUỆ NGUYÊN
-- Migration 003
-- Admin + RBAC
-- =========================================================

-- =========================================================
-- 1. ADMIN USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT admin_users_user_fk
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    CONSTRAINT admin_users_status_check
        CHECK (
            status IN (
                'active',
                'inactive',
                'suspended'
            )
        )
);


-- =========================================================
-- 2. ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    code VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 3. PERMISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,

    code VARCHAR(150) NOT NULL UNIQUE,

    description TEXT,

    module VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 4. ADMIN USER ↔ ROLE
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.admin_user_roles (
    admin_user_id UUID NOT NULL,

    role_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    assigned_by UUID,

    PRIMARY KEY (admin_user_id, role_id),

    CONSTRAINT admin_user_roles_admin_fk
        FOREIGN KEY (admin_user_id)
        REFERENCES admin.admin_users(id)
        ON DELETE CASCADE,

    CONSTRAINT admin_user_roles_role_fk
        FOREIGN KEY (role_id)
        REFERENCES admin.roles(id)
        ON DELETE CASCADE,

    CONSTRAINT admin_user_roles_assigned_by_fk
        FOREIGN KEY (assigned_by)
        REFERENCES admin.admin_users(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 5. ROLE ↔ PERMISSION
-- =========================================================

CREATE TABLE IF NOT EXISTS admin.role_permissions (
    role_id UUID NOT NULL,

    permission_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT role_permissions_role_fk
        FOREIGN KEY (role_id)
        REFERENCES admin.roles(id)
        ON DELETE CASCADE,

    CONSTRAINT role_permissions_permission_fk
        FOREIGN KEY (permission_id)
        REFERENCES admin.permissions(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 6. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS admin_users_user_idx
ON admin.admin_users(user_id);

CREATE INDEX IF NOT EXISTS admin_users_status_idx
ON admin.admin_users(status);

CREATE INDEX IF NOT EXISTS admin_user_roles_role_idx
ON admin.admin_user_roles(role_id);

CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
ON admin.role_permissions(permission_id);

CREATE INDEX IF NOT EXISTS permissions_module_idx
ON admin.permissions(module);


-- =========================================================
-- END MIGRATION 003
-- =========================================================