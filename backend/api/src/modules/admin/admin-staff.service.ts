
import pool from "../../database/postgres";
import { hashPassword } from "../../utils/password";
import crypto from "crypto";

const SUPER_ADMIN = "SUPER_ADMIN";

function assertSuperAdmin(roles: string[]) {
  if (!roles.includes(SUPER_ADMIN)) {
    throw new Error("SUPER_ADMIN_REQUIRED");
  }
}

export async function getAdminStaff(
  roles: string[],
  page = 1,
  limit = 20,
  search = ""
) {
  assertSuperAdmin(roles);

  const offset = (page - 1) * limit;
  const keyword = search.trim();

  const result = await pool.query(
    `
    SELECT
      au.id AS admin_id,
      u.id AS user_id,
      u.email,
      u.phone,
      u.status AS user_status,
      au.status AS admin_status,
      up.full_name,
      au.created_at,
      COALESCE(
        ARRAY_AGG(DISTINCT r.code)
          FILTER (WHERE r.code IS NOT NULL),
        ARRAY[]::text[]
      ) AS roles
    FROM admin.admin_users au
    JOIN auth.users u ON u.id = au.user_id
    LEFT JOIN member.user_profiles up ON up.user_id = u.id
    LEFT JOIN admin.admin_user_roles aur
      ON aur.admin_user_id = au.id
    LEFT JOIN admin.roles r ON r.id = aur.role_id
    WHERE u.deleted_at IS NULL
      AND (
        $1 = ''
        OR u.email ILIKE '%' || $1 || '%'
        OR u.phone ILIKE '%' || $1 || '%'
        OR up.full_name ILIKE '%' || $1 || '%'
      )
    GROUP BY au.id, u.id, up.full_name
    ORDER BY au.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [keyword, limit, offset]
  );

  const count = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM admin.admin_users au
    JOIN auth.users u ON u.id = au.user_id
    LEFT JOIN member.user_profiles up ON up.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND (
        $1 = ''
        OR u.email ILIKE '%' || $1 || '%'
        OR u.phone ILIKE '%' || $1 || '%'
        OR up.full_name ILIKE '%' || $1 || '%'
      )
    `,
    [keyword]
  );

  return {
    items: result.rows,
    pagination: {
      page,
      limit,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / limit),
    },
  };
}

export async function createAdminStaff(
  input: {
    email: string;
    phone?: string;
    fullName: string;
    password: string;
    roleCode: string;
  },
  actor: {
    adminId: string;
    roles: string[];
    ip?: string;
    userAgent?: string;
  }
) {
  assertSuperAdmin(actor.roles);

  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const fullName = input.fullName.trim();
  const roleCode = input.roleCode.trim().toUpperCase();

  if (roleCode === SUPER_ADMIN) {
    throw new Error("CANNOT_CREATE_SUPER_ADMIN");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query(
      `
      SELECT id, code
      FROM admin.roles
      WHERE code = $1
      LIMIT 1
      `,
      [roleCode]
    );

    if (!roleResult.rows.length) {
      throw new Error("ROLE_NOT_FOUND");
    }

    const existing = await client.query(
      `
      SELECT id
      FROM auth.users
      WHERE LOWER(email) = LOWER($1)
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [email]
    );

    if (existing.rows.length) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    if (phone) {
      const existingPhone = await client.query(
        `
        SELECT id
        FROM auth.users
        WHERE phone = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [phone]
      );

      if (existingPhone.rows.length) {
        throw new Error("PHONE_ALREADY_EXISTS");
      }
    }

    const passwordHash = await hashPassword(input.password);

    const userResult = await client.query(
      `
      INSERT INTO auth.users (
        email,
        phone,
        password_hash,
        status,
        email_verified_at
      )
      VALUES ($1, $2, $3, 'active', NOW())
      RETURNING id, email, phone, status, created_at
      `,
      [email, phone, passwordHash]
    );

    const user = userResult.rows[0];

    await client.query(
      `
      INSERT INTO member.user_profiles (
        user_id,
        full_name,
        phone_number
      )
      VALUES ($1, $2, $3)
      `,
      [user.id, fullName, phone]
    );

    const adminResult = await client.query(
      `
      INSERT INTO admin.admin_users (
        user_id,
        status
      )
      VALUES ($1, 'active')
      RETURNING id, status, created_at
      `,
      [user.id]
    );

    const admin = adminResult.rows[0];

    await client.query(
      `
      INSERT INTO admin.admin_user_roles (
        admin_user_id,
        role_id,
        assigned_by
      )
      VALUES ($1, $2, $3)
      `,
      [admin.id, roleResult.rows[0].id, actor.adminId]
    );

    await client.query(
      `
      INSERT INTO admin.activity_logs (
        admin_user_id,
        action,
        module,
        entity_type,
        entity_id,
        description,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1,
        'CREATE',
        'STAFF',
        'ADMIN_USER',
        $2,
        'Tạo tài khoản nhân viên quản trị',
        $3,
        $4,
        $5::jsonb
      )
      `,
      [
        actor.adminId,
        admin.id,
        actor.ip || null,
        actor.userAgent || null,
        JSON.stringify({
          email,
          roleCode,
        }),
      ]
    );

    await client.query("COMMIT");

    return {
      user,
      admin,
      role: roleCode,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAdminStaffRoles(roles: string[]) {
  assertSuperAdmin(roles);

  const result = await pool.query(
    `
    SELECT
      r.id,
      r.name,
      r.code,
      r.description,
      r.is_system_role,
      COUNT(rp.permission_id)::int AS permission_count
    FROM admin.roles r
    LEFT JOIN admin.role_permissions rp
      ON rp.role_id = r.id
    WHERE r.code <> 'SUPER_ADMIN'
    GROUP BY r.id
    ORDER BY r.name
    `
  );

  return result.rows;
}


export async function updateAdminStaffRole(
  targetAdminId: string,
  roleCode: string,
  actor: {
    adminId: string;
    roles: string[];
    ip?: string;
    userAgent?: string;
  }
) {
  assertSuperAdmin(actor.roles);

  assertSuperAdmin(actor.roles);

    if (actor.adminId === targetAdminId) {
    throw new Error("CANNOT_MODIFY_SELF");
    }

    const normalizedRole = roleCode.trim().toUpperCase();

  if (normalizedRole === SUPER_ADMIN) {
    throw new Error("CANNOT_ASSIGN_SUPER_ADMIN");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const targetResult = await client.query(
    `
        SELECT au.id, u.email
        FROM admin.admin_users au
        JOIN auth.users u ON u.id = au.user_id
        WHERE au.id = $1
        AND u.deleted_at IS NULL
        FOR UPDATE OF au
    `,
    [targetAdminId]
    );

    if (targetResult.rows.length === 0) {
    throw new Error("STAFF_NOT_FOUND");
    }

    const currentRolesResult = await client.query(
    `
        SELECT r.code
        FROM admin.admin_user_roles aur
        JOIN admin.roles r ON r.id = aur.role_id
        WHERE aur.admin_user_id = $1
    `,
    [targetAdminId]
    );

    const roleResult = await client.query(
    `
        SELECT id, code
        FROM admin.roles
        WHERE code = $1
        AND code <> 'SUPER_ADMIN'
        LIMIT 1
    `,
    [normalizedRole]
    );

    const oldRoles = currentRolesResult.rows.map(
        (row: { code: string }) => String(row.code).trim().toUpperCase()
    );

    if (oldRoles.includes(SUPER_ADMIN)) {
        throw new Error("CANNOT_MODIFY_SUPER_ADMIN");
    }

    if (roleResult.rows.length === 0) {
        throw new Error("ROLE_NOT_FOUND");
    }

    await client.query(
      `
      DELETE FROM admin.admin_user_roles
      WHERE admin_user_id = $1
      `,
      [targetAdminId]
    );

    await client.query(
      `
      INSERT INTO admin.admin_user_roles (
        admin_user_id,
        role_id,
        assigned_by
      )
      VALUES ($1, $2, $3)
      `,
      [
        targetAdminId,
        roleResult.rows[0].id,
        actor.adminId,
      ]
    );

    await client.query(
      `
      INSERT INTO admin.activity_logs (
        admin_user_id,
        action,
        module,
        entity_type,
        entity_id,
        description,
        ip_address,
        user_agent,
        metadata
      )
      VALUES (
        $1, 'UPDATE_ROLE', 'STAFF', 'ADMIN_USER',
        $2, 'Thay đổi vai trò nhân viên',
        $3, $4, $5::jsonb
      )
      `,
      [
        actor.adminId,
        targetAdminId,
        actor.ip || null,
        actor.userAgent || null,
        JSON.stringify({
          oldRoles,
          newRole: normalizedRole,
        }),
      ]
    );

    await client.query("COMMIT");

    return {
      adminId: targetAdminId,
      oldRoles,
      newRole: normalizedRole,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdminStaffStatus(
  targetAdminId: string,
  status: "active" | "blocked",
  actor: {
    adminId: string;
    roles: string[];
    ip?: string;
    userAgent?: string;
  }
) {
  assertSuperAdmin(actor.roles);

  if (actor.adminId === targetAdminId) {
    throw new Error("CANNOT_MODIFY_SELF");
  }

  if (!["active", "blocked"].includes(status)) {
    throw new Error("INVALID_STATUS");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const targetResult = await client.query(
      `
      SELECT au.id, au.user_id, u.email
      FROM admin.admin_users au
      JOIN auth.users u ON u.id = au.user_id
      WHERE au.id = $1
        AND u.deleted_at IS NULL
      FOR UPDATE OF au, u
      `,
      [targetAdminId]
    );

    if (targetResult.rows.length === 0) {
      throw new Error("STAFF_NOT_FOUND");
    }

    const userId = targetResult.rows[0].user_id;

    const rolesResult = await client.query(
      `
      SELECT r.code
      FROM admin.admin_user_roles aur
      JOIN admin.roles r ON r.id = aur.role_id
      WHERE aur.admin_user_id = $1
      `,
      [targetAdminId]
    );

    const oldRoles = rolesResult.rows.map(
      (row: { code: string }) => row.code
    );

    if (oldRoles.includes(SUPER_ADMIN)) {
      throw new Error("CANNOT_MODIFY_SUPER_ADMIN");
    }

    await client.query(
        `
        UPDATE admin.admin_users
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        `,
        [status === "blocked" ? "suspended" : "active", targetAdminId]
        );

    await client.query(
      `
      UPDATE auth.users
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [status, userId]
    );

    if (status === "blocked") {
      await client.query(
        `
        UPDATE auth.user_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
        [userId]
      );

      await client.query(
        `
        UPDATE auth.refresh_tokens
        SET revoked_at = NOW(),
            revoke_reason = 'ADMIN_BLOCKED'
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
        [userId]
      );
    }

    await client.query(
      `
      INSERT INTO admin.activity_logs (
        admin_user_id,
        action,
        module,
        entity_type,
        entity_id,
        description,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, 'STAFF', 'ADMIN_USER', $3, $4, $5, $6, $7::jsonb)
      `,
      [
        actor.adminId,
        status === "blocked" ? "BLOCK_STAFF" : "UNBLOCK_STAFF",
        targetAdminId,
        status === "blocked"
          ? "Khóa tài khoản nhân viên"
          : "Mở khóa tài khoản nhân viên",
        actor.ip || null,
        actor.userAgent || null,
        JSON.stringify({ oldRoles, newStatus: status }),
      ]
    );

    await client.query("COMMIT");

    return {
      adminId: targetAdminId,
      status,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function getAdminStaffActivityLogs(
  roles: string[],
  page = 1,
  limit = 20,
  search = "",
  action = ""
) {
  assertSuperAdmin(roles);

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [`al.module = 'STAFF'`];
  const params: any[] = [];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(
      `(al.description ILIKE $${params.length}
        OR al.action ILIKE $${params.length}
        OR u.email ILIKE $${params.length})`
    );
  }

  if (action.trim()) {
    params.push(action.trim().toUpperCase());
    conditions.push(`al.action = $${params.length}`);
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM admin.activity_logs al
    LEFT JOIN admin.admin_users au ON au.id = al.admin_user_id
    LEFT JOIN auth.users u ON u.id = au.user_id
    WHERE ${whereClause}
    `,
    params
  );

  const dataResult = await pool.query(
    `
    SELECT
      al.id,
      al.admin_user_id,
      u.email AS admin_email,
      al.action,
      al.module,
      al.entity_type,
      al.entity_id,
      al.description,
      al.ip_address,
      al.user_agent,
      al.metadata,
      al.created_at
    FROM admin.activity_logs al
    LEFT JOIN admin.admin_users au ON au.id = al.admin_user_id
    LEFT JOIN auth.users u ON u.id = au.user_id
    WHERE ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, safeLimit, offset]
  );

  return {
    items: dataResult.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(
        countResult.rows[0].total / safeLimit
      ),
    },
  };
}

