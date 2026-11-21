import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import pool from "../../database/postgres";

export interface AdminVoucherInput {
  code: string;
  name: string;
  description?: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount?: number;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  starts_at: string;
  ends_at: string;
  is_active?: boolean;
  category_ids?: string[];
  food_ids?: string[];
}

export interface AdminVoucherFilters {
  search?: string;
  status?: "all" | "active" | "inactive" | "upcoming" | "expired";
  page?: number;
  limit?: number;
}

function normalizeIds(ids?: string[]) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

function validateVoucherInput(data: AdminVoucherInput) {
  if (!data.code?.trim()) {
    throw new Error("VOUCHER_CODE_REQUIRED");
  }

  if (!data.name?.trim()) {
    throw new Error("VOUCHER_NAME_REQUIRED");
  }

  if (!["percentage", "fixed_amount"].includes(data.discount_type)) {
    throw new Error("INVALID_DISCOUNT_TYPE");
  }

  const discountValue = Number(data.discount_value);

  if (!Number.isFinite(discountValue) || discountValue < 0) {
    throw new Error("INVALID_DISCOUNT_VALUE");
  }

  if (
    data.discount_type === "percentage" &&
    discountValue > 100
  ) {
    throw new Error("INVALID_PERCENTAGE");
  }

  const minOrder = Number(data.min_order_amount ?? 0);

  if (!Number.isFinite(minOrder) || minOrder < 0) {
    throw new Error("INVALID_MIN_ORDER_AMOUNT");
  }

  if (
    data.max_discount_amount != null &&
    (!Number.isFinite(Number(data.max_discount_amount)) ||
      Number(data.max_discount_amount) < 0)
  ) {
    throw new Error("INVALID_MAX_DISCOUNT_AMOUNT");
  }

  if (
    data.usage_limit != null &&
    (!Number.isInteger(Number(data.usage_limit)) ||
      Number(data.usage_limit) < 0)
  ) {
    throw new Error("INVALID_USAGE_LIMIT");
  }

  if (
    data.per_user_limit != null &&
    (!Number.isInteger(Number(data.per_user_limit)) ||
      Number(data.per_user_limit) < 0)
  ) {
    throw new Error("INVALID_PER_USER_LIMIT");
  }

  const startsAt = new Date(data.starts_at);
  const endsAt = new Date(data.ends_at);

  if (
    !data.starts_at ||
    !data.ends_at ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    throw new Error("INVALID_VOUCHER_TIME");
  }
}

async function replaceVoucherRestrictions(
  client: PoolClient,
  voucherId: string,
  categoryIds: string[],
  foodIds: string[]
) {
  await client.query(
    `DELETE FROM promotion.voucher_categories WHERE voucher_id = $1`,
    [voucherId]
  );

  await client.query(
    `DELETE FROM promotion.voucher_foods WHERE voucher_id = $1`,
    [voucherId]
  );

  for (const categoryId of categoryIds) {
    await client.query(
      `
      INSERT INTO promotion.voucher_categories (
        id,
        voucher_id,
        category_id
      )
      VALUES ($1, $2, $3)
      `,
      [randomUUID(), voucherId, categoryId]
    );
  }

  for (const foodId of foodIds) {
    await client.query(
      `
      INSERT INTO promotion.voucher_foods (
        id,
        voucher_id,
        food_id
      )
      VALUES ($1, $2, $3)
      `,
      [randomUUID(), voucherId, foodId]
    );
  }
}

// Danh sách Voucher
export async function getAdminVouchers(
  filters: AdminVoucherFilters = {}
) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim()}%`);
    conditions.push(
      `(v.code ILIKE $${values.length} OR v.name ILIKE $${values.length})`
    );
  }

  switch (filters.status) {
    case "active":
      conditions.push(
        "v.is_active = TRUE AND v.starts_at <= NOW() AND v.ends_at > NOW()"
      );
      break;

    case "inactive":
      conditions.push("v.is_active = FALSE");
      break;

    case "upcoming":
      conditions.push("v.starts_at > NOW()");
      break;

    case "expired":
      conditions.push("v.ends_at <= NOW()");
      break;
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM promotion.vouchers v
    ${whereClause}
    `,
    values
  );

  const total = countResult.rows[0].total;

  const result = await pool.query(
    `
    SELECT
      v.*,
      COALESCE(uc.category_count, 0)::int AS category_count,
      COALESCE(uf.food_count, 0)::int AS food_count
    FROM promotion.vouchers v

    LEFT JOIN (
      SELECT voucher_id, COUNT(*) AS category_count
      FROM promotion.voucher_categories
      GROUP BY voucher_id
    ) uc ON uc.voucher_id = v.id

    LEFT JOIN (
      SELECT voucher_id, COUNT(*) AS food_count
      FROM promotion.voucher_foods
      GROUP BY voucher_id
    ) uf ON uf.voucher_id = v.id

    ${whereClause}
    ORDER BY v.created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Chi tiết Voucher
export async function getAdminVoucherById(id: string) {
  const result = await pool.query(
    `
    SELECT *
    FROM promotion.vouchers
    WHERE id = $1
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const voucher = result.rows[0];

  const [categories, foods, usage] = await Promise.all([
    pool.query(
      `
      SELECT
        vc.category_id AS id,
        fc.name
      FROM promotion.voucher_categories vc
      JOIN menu.food_categories fc
        ON fc.id = vc.category_id
      WHERE vc.voucher_id = $1
      ORDER BY fc.sort_order, fc.name
      `,
      [id]
    ),

    pool.query(
      `
      SELECT
        vf.food_id AS id,
        f.name,
        f.price,
        f.sale_price
      FROM promotion.voucher_foods vf
      JOIN menu.foods f
        ON f.id = vf.food_id
      WHERE vf.voucher_id = $1
      ORDER BY f.name
      `,
      [id]
    ),

    pool.query(
      `
      SELECT
        COUNT(*)::int AS total_usage,
        COALESCE(SUM(discount_amount), 0) AS total_discount
      FROM promotion.voucher_usage_history
      WHERE voucher_id = $1
      `,
      [id]
    ),
  ]);

  return {
    ...voucher,
    categories: categories.rows,
    foods: foods.rows,
    usage: usage.rows[0],
  };
}

// Tạo Voucher
export async function createAdminVoucher(
  data: AdminVoucherInput
) {
  validateVoucherInput(data);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO promotion.vouchers (
        code,
        name,
        description,
        discount_type,
        discount_value,
        max_discount_amount,
        min_order_amount,
        usage_limit,
        used_count,
        per_user_limit,
        starts_at,
        ends_at,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, 0, $9, $10, $11, $12
      )
      RETURNING *
      `,
      [
        data.code.trim().toUpperCase(),
        data.name.trim(),
        data.description ?? null,
        data.discount_type,
        data.discount_value,
        data.max_discount_amount ?? null,
        data.min_order_amount ?? 0,
        data.usage_limit ?? null,
        data.per_user_limit ?? null,
        data.starts_at,
        data.ends_at,
        data.is_active ?? true,
      ]
    );

    const voucher = result.rows[0];

    await replaceVoucherRestrictions(
      client,
      voucher.id,
      normalizeIds(data.category_ids),
      normalizeIds(data.food_ids)
    );

    await client.query("COMMIT");

    return voucher;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Cập nhật Voucher
export async function updateAdminVoucher(
  id: string,
  data: AdminVoucherInput
) {
  validateVoucherInput(data);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE promotion.vouchers
      SET
        code = $2,
        name = $3,
        description = $4,
        discount_type = $5,
        discount_value = $6,
        max_discount_amount = $7,
        min_order_amount = $8,
        usage_limit = $9,
        per_user_limit = $10,
        starts_at = $11,
        ends_at = $12,
        is_active = $13,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        data.code.trim().toUpperCase(),
        data.name.trim(),
        data.description ?? null,
        data.discount_type,
        data.discount_value,
        data.max_discount_amount ?? null,
        data.min_order_amount ?? 0,
        data.usage_limit ?? null,
        data.per_user_limit ?? null,
        data.starts_at,
        data.ends_at,
        data.is_active ?? true,
      ]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await replaceVoucherRestrictions(
      client,
      id,
      normalizeIds(data.category_ids),
      normalizeIds(data.food_ids)
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Bật / tắt Voucher
export async function updateAdminVoucherStatus(
  id: string,
  isActive: boolean
) {
  const result = await pool.query(
    `
    UPDATE promotion.vouchers
    SET
      is_active = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, isActive]
  );

  return result.rows[0] ?? null;
}

// Xóa Voucher
export async function deleteAdminVoucher(id: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const voucherResult = await client.query(
      `
      SELECT id
      FROM promotion.vouchers
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (!voucherResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const usageResult = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM promotion.voucher_usage_history
        WHERE voucher_id = $1
      ) AS has_usage
      `,
      [id]
    );

    if (usageResult.rows[0].has_usage) {
      throw new Error("VOUCHER_HAS_USAGE_HISTORY");
    }

    await client.query(
      `DELETE FROM promotion.voucher_categories WHERE voucher_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM promotion.voucher_foods WHERE voucher_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM promotion.voucher_user_limits WHERE voucher_id = $1`,
      [id]
    );

    await client.query(
      `DELETE FROM promotion.vouchers WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
