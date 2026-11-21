
import  pool  from "../../database/postgres";

export interface AdminOrderFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: "newest" | "oldest" | "highest";
}

const allowedStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "rejected",
];

const allowedSorts = {
  newest: "o.created_at DESC",
  oldest: "o.created_at ASC",
  highest: "o.grand_total DESC",
} as const;

export async function getAdminOrders(filters: AdminOrderFilters) {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit || 10)));
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy || "newest";

  if (!Object.prototype.hasOwnProperty.call(allowedSorts, sortBy)) {
    throw new Error("INVALID_ORDER_SORT");
  }

  const orderByClause =
    allowedSorts[sortBy as keyof typeof allowedSorts];

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    if (!allowedStatuses.includes(filters.status)) {
      throw new Error("INVALID_ORDER_STATUS");
    }

    params.push(filters.status);
    conditions.push(`o.status = $${params.length}`);
  }

  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    conditions.push(
      `(o.order_code ILIKE $${params.length}
        OR o.customer_name ILIKE $${params.length}
        OR o.customer_phone ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM orders.customer_orders o
     ${whereClause}`,
    params
  );

  const total = countResult.rows[0].total;

  const listParams = [...params, limit, offset];

  const result = await pool.query(
    `SELECT
       o.id,
       o.order_code,
       o.user_id,
       o.order_type,
       o.source,
       o.customer_name,
       o.customer_phone,
       o.customer_email,
       o.note,
       o.delivery_address_snapshot,
       o.subtotal,
       o.discount_total,
       o.delivery_fee,
       o.tax_total,
       o.grand_total,
       o.currency,
       o.status,
       o.created_at,
       o.updated_at,
       (
         SELECT COALESCE(SUM(oi.quantity), 0)::int
         FROM orders.order_items oi
         WHERE oi.order_id = o.id
       ) AS total_items
     FROM orders.customer_orders o
     ${whereClause}
     ORDER BY ${orderByClause}, o.id DESC
     LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
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
