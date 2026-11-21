
import pool from "../../database/postgres";

export interface AdminMemberFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: "newest" | "oldest" | "name";
}

const allowedSorts = {
  newest: "u.created_at DESC",
  oldest: "u.created_at ASC",
  name: "p.full_name ASC NULLS LAST",
} as const;

/**
 * Lấy danh sách khách hàng dành cho Admin.
 */
export async function getAdminMembers(
  filters: AdminMemberFilters
) {
  const page = Math.max(
    1,
    Math.floor(filters.page || 1)
  );

  const limit = Math.min(
    100,
    Math.max(1, Math.floor(filters.limit || 10))
  );

  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy || "newest";

  if (
    !Object.prototype.hasOwnProperty.call(
      allowedSorts,
      sortBy
    )
  ) {
    throw new Error("INVALID_MEMBER_SORT");
  }

  const orderByClause =
    allowedSorts[
      sortBy as keyof typeof allowedSorts
    ];

  const conditions: string[] = [
    "u.deleted_at IS NULL",
  ];

  const params: unknown[] = [];

  if (filters.status?.trim()) {
    params.push(filters.status.trim());

    conditions.push(
      `u.status = $${params.length}`
    );
  }

  if (filters.search?.trim()) {
    params.push(
      `%${filters.search.trim()}%`
    );

    conditions.push(`
      (
        p.full_name ILIKE $${params.length}
        OR u.email ILIKE $${params.length}
        OR u.phone ILIKE $${params.length}
        OR p.phone_number ILIKE $${params.length}
      )
    `);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // Đếm tổng số khách hàng.
  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM auth.users u
    LEFT JOIN member.user_profiles p
      ON p.user_id = u.id
    ${whereClause}
    `,
    params
  );

  const total = countResult.rows[0].total;

  // Lấy danh sách khách hàng.
  const listParams = [
    ...params,
    limit,
    offset,
  ];

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.phone AS account_phone,

      COALESCE(
        NULLIF(p.phone_number, ''),
        NULLIF(u.phone, '')
      ) AS phone,

      p.full_name,
      p.avatar_url,
      p.date_of_birth,
      p.gender,

      u.status,
      u.email_verified_at,
      u.phone_verified_at,
      u.last_login_at,
      u.created_at,
      u.updated_at,

      u.locked_until,

      (
        SELECT COUNT(*)::int
        FROM member.user_addresses a
        WHERE a.user_id = u.id
      ) AS total_addresses

    FROM auth.users u

    LEFT JOIN member.user_profiles p
      ON p.user_id = u.id

    ${whereClause}

    ORDER BY ${orderByClause}, u.id DESC

    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    listParams
  );

  return {
    items: result.rows,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
