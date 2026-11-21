import pool from "../../database/postgres";

/** Tỉ lệ giảm giá tối đa (so với tiền hàng) cho nhân viên không phải quản lý. */
const STAFF_DISCOUNT_LIMIT = 0.2;
/** Giảm từ ngưỡng này trở lên bị gắn cờ "giảm sâu" trên trang giám sát. */
const DEEP_DISCOUNT_RATIO = 0.2;

export class AuditError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "INVALID_STATE"
      | "OVER_LIMIT",
    message: string
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------
// NHÂN VIÊN BẤM GIẢM GIÁ
// ---------------------------------------------------------------

export async function applyManualDiscount(params: {
  orderId: string;
  adminUserId: string;
  roles: string[];
  amount: unknown;
  reason: unknown;
}) {
  const amount = Number(params.amount);
  const reason =
    typeof params.reason === "string"
      ? params.reason.normalize("NFC").trim()
      : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AuditError("INVALID_INPUT", "Số tiền giảm phải lớn hơn 0");
  }
  if (reason.length < 3) {
    throw new AuditError("INVALID_INPUT", "Vui lòng nhập lý do giảm giá");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const o = await client.query(
      `SELECT subtotal, discount_total, delivery_fee, tax_total, status
       FROM orders.customer_orders WHERE id = $1 FOR UPDATE`,
      [params.orderId]
    );
    if (o.rowCount === 0) throw new AuditError("NOT_FOUND", "Không thấy đơn hàng");

    const order = o.rows[0];
    if (["completed", "cancelled", "rejected"].includes(order.status)) {
      throw new AuditError(
        "INVALID_STATE",
        "Đơn đã chốt bill hoặc đã huỷ, không thể giảm giá"
      );
    }

    const subtotal = Number(order.subtotal);
    const oldDiscount = Number(order.discount_total);
    const newDiscount = oldDiscount + amount;

    if (newDiscount > subtotal) {
      throw new AuditError("INVALID_INPUT", "Tổng giảm giá vượt quá tiền hàng");
    }

    const isManager = params.roles.some((r) =>
      ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(r)
    );
    if (!isManager && newDiscount > subtotal * STAFF_DISCOUNT_LIMIT) {
      throw new AuditError(
        "OVER_LIMIT",
        `Nhân viên chỉ được giảm tối đa ${STAFF_DISCOUNT_LIMIT * 100}% tiền hàng. Cần quản lý duyệt.`
      );
    }

    const grandTotal =
      subtotal - newDiscount + Number(order.delivery_fee) + Number(order.tax_total);

    await client.query(
      `UPDATE orders.customer_orders
       SET discount_total = $2, grand_total = $3, updated_at = NOW()
       WHERE id = $1`,
      [params.orderId, newDiscount, grandTotal]
    );

    await client.query(
      `INSERT INTO orders.order_discount_logs
         (order_id, admin_user_id, old_discount, new_discount, delta, reason)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [params.orderId, params.adminUserId, oldDiscount, newDiscount, amount, reason]
    );

    await client.query("COMMIT");
    return { discountTotal: newDiscount, grandTotal };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Lỗi rollback giảm giá:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------
// TRANG GIÁM SÁT
// ---------------------------------------------------------------

function dateRange(from?: string, to?: string) {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const start = from && dateRe.test(from) ? from : null;
  const end = to && dateRe.test(to) ? to : null;
  return { start, end };
}

export async function getStaffActivitySummary(from?: string, to?: string) {
  const { start, end } = dateRange(from, to);
  // $1 = từ ngày, $2 = đến ngày (bao gồm cả ngày cuối: < to + 1 ngày)
  const params = [start, end];
  const timeCond = (col: string) =>
    `($1::date IS NULL OR ${col} >= $1::date)
     AND ($2::date IS NULL OR ${col} < ($2::date + 1))`;

  const cancels = await pool.query(
    `SELECT h.changed_by AS user_id, COUNT(*)::int AS cnt,
            COALESCE(SUM(o.grand_total),0) AS amount
     FROM orders.order_status_history h
     JOIN orders.customer_orders o ON o.id = h.order_id
     WHERE h.new_status IN ('cancelled','rejected')
       AND h.changed_by IS NOT NULL AND ${timeCond("h.created_at")}
     GROUP BY h.changed_by`,
    params
  );
  const discounts = await pool.query(
    `SELECT admin_user_id AS user_id, COUNT(*)::int AS cnt,
            COALESCE(SUM(delta),0) AS amount
     FROM orders.order_discount_logs
     WHERE admin_user_id IS NOT NULL AND ${timeCond("created_at")}
     GROUP BY admin_user_id`,
    params
  );
  const wastes = await pool.query(
    `SELECT created_by AS user_id, COUNT(*)::int AS cnt,
            COALESCE(SUM(m.quantity * i.last_cost * -1),0) AS amount
     FROM inventory.movements m
     JOIN inventory.items i ON i.id = m.item_id
     WHERE m.movement_type = 'waste' AND m.created_by IS NOT NULL
       AND ${timeCond("m.created_at")}
     GROUP BY created_by`,
    params
  );

  const ids = new Set<string>([
    ...cancels.rows.map((r) => r.user_id),
    ...discounts.rows.map((r) => r.user_id),
    ...wastes.rows.map((r) => r.user_id),
  ]);
  if (ids.size === 0) return [];

  const users = await pool.query(
    `SELECT id, email, phone FROM auth.users WHERE id = ANY($1::uuid[])`,
    [[...ids]]
  );
  const userMap = new Map(users.rows.map((u) => [u.id as string, u]));
  const pick = (rows: { user_id: string; cnt: number; amount: string }[], id: string) => {
    const r = rows.find((x) => x.user_id === id);
    return { count: r?.cnt ?? 0, amount: Number(r?.amount ?? 0) };
  };

  return [...ids]
    .map((id) => ({
      userId: id,
      email: userMap.get(id)?.email ?? null,
      phone: userMap.get(id)?.phone ?? null,
      cancel: pick(cancels.rows, id),
      discount: pick(discounts.rows, id),
      waste: pick(wastes.rows, id),
    }))
    .sort(
      (a, b) =>
        b.cancel.count + b.discount.count - (a.cancel.count + a.discount.count)
    );
}

export async function getStaffActivityEvents(filters: {
  type?: string;
  staffId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const { start, end } = dateRange(filters.from, filters.to);
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const staffId =
    filters.staffId && uuidRe.test(filters.staffId) ? filters.staffId : null;
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 300);
  const type = filters.type;
  const params = [start, end, staffId];
  const timeCond = (col: string) =>
    `($1::date IS NULL OR ${col} >= $1::date)
     AND ($2::date IS NULL OR ${col} < ($2::date + 1))`;

  const parts: string[] = [];

  if (!type || type === "cancel") {
    parts.push(`
      SELECT 'cancel'::text AS event_type, h.created_at, h.changed_by AS user_id,
             o.order_code, o.grand_total AS amount,
             h.note AS reason, h.old_status AS detail,
             (h.old_status IN ('preparing','ready','out_for_delivery')) AS flagged
      FROM orders.order_status_history h
      JOIN orders.customer_orders o ON o.id = h.order_id
      WHERE h.new_status IN ('cancelled','rejected') AND h.changed_by IS NOT NULL
        AND ${timeCond("h.created_at")}
        AND ($3::uuid IS NULL OR h.changed_by = $3::uuid)`);
  }
  if (!type || type === "discount") {
    parts.push(`
      SELECT 'discount'::text AS event_type, d.created_at, d.admin_user_id AS user_id,
             o.order_code, d.delta AS amount,
             d.reason, ROUND(d.new_discount / NULLIF(o.subtotal,0) * 100)::text || '% tiền hàng' AS detail,
             (d.new_discount >= o.subtotal * ${DEEP_DISCOUNT_RATIO}) AS flagged
      FROM orders.order_discount_logs d
      JOIN orders.customer_orders o ON o.id = d.order_id
      WHERE ${timeCond("d.created_at")}
        AND ($3::uuid IS NULL OR d.admin_user_id = $3::uuid)`);
  }
  if (!type || type === "waste") {
    parts.push(`
      SELECT 'waste'::text AS event_type, m.created_at, m.created_by AS user_id,
             NULL::varchar AS order_code, (-m.quantity * i.last_cost) AS amount,
             m.reason, i.name || ' ×' || (-m.quantity)::text || ' ' || i.unit AS detail,
             ((-m.quantity * i.last_cost) >= 200000) AS flagged
      FROM inventory.movements m
      JOIN inventory.items i ON i.id = m.item_id
      WHERE m.movement_type = 'waste' AND ${timeCond("m.created_at")}
        AND ($3::uuid IS NULL OR m.created_by = $3::uuid)`);
  }
  if (parts.length === 0) return [];

  const r = await pool.query(
    `SELECT e.*, u.email AS staff_email
     FROM (${parts.join(" UNION ALL ")}) e
     LEFT JOIN auth.users u ON u.id = e.user_id
     ORDER BY e.created_at DESC
     LIMIT ${limit}`,
    params
  );
  return r.rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}
