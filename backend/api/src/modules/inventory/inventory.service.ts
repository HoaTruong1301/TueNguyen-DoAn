import type { PoolClient } from "pg";
import pool from "../../database/postgres";

export type MovementType =
  | "purchase_in"
  | "sale_out"
  | "transfer_out"
  | "transfer_in"
  | "waste"
  | "adjust";

export class InventoryError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_STOCK"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "INVALID_STATE",
    message: string
  ) {
    super(message);
  }
}

type Db = Pick<PoolClient, "query">;

/**
 * Cổng DUY NHẤT thay đổi tồn kho. Mọi nghiệp vụ (nhập, bán, điều chuyển,
 * huỷ, điều chỉnh) đều gọi hàm này để tồn và sổ biến động luôn khớp nhau.
 * quantity: số có dấu (+ nhập vào, - xuất ra).
 */
export async function applyMovement(
  db: Db,
  input: {
    warehouseId: string;
    itemId: string;
    type: MovementType;
    quantity: number;
    refType?: string;
    refId?: string;
    reason?: string | null;
    userId?: string | null;
    allowNegative?: boolean;
  }
): Promise<number> {
  if (!Number.isFinite(input.quantity) || input.quantity === 0) {
    throw new InventoryError("INVALID_INPUT", "Số lượng không hợp lệ");
  }

  const stockResult = await db.query(
    `INSERT INTO inventory.stock (warehouse_id, item_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (warehouse_id, item_id)
     DO UPDATE SET quantity = inventory.stock.quantity + EXCLUDED.quantity,
                   updated_at = NOW()
     RETURNING quantity`,
    [input.warehouseId, input.itemId, input.quantity]
  );

  const balance = Number(stockResult.rows[0].quantity);

  if (balance < 0 && !input.allowNegative) {
    // Throw để transaction bên ngoài ROLLBACK, tồn không bị đổi
    throw new InventoryError(
      "INSUFFICIENT_STOCK",
      "Tồn kho không đủ để thực hiện thao tác"
    );
  }

  await db.query(
    `INSERT INTO inventory.movements
       (warehouse_id, item_id, movement_type, quantity, balance_after,
        ref_type, ref_id, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.warehouseId,
      input.itemId,
      input.type,
      input.quantity,
      balance,
      input.refType ?? null,
      input.refId ?? null,
      input.reason ?? null,
      input.userId ?? null,
    ]
  );

  return balance;
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Lỗi rollback kho:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

function makeCode(prefix: string) {
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `${prefix}-${ymd}-${rand}`;
}

function parsePositive(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new InventoryError("INVALID_INPUT", `${label} phải là số dương`);
  }
  return n;
}

function requireUuid(value: unknown, label: string): string {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof value !== "string" || !re.test(value)) {
    throw new InventoryError("INVALID_INPUT", `${label} không hợp lệ`);
  }
  return value;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.normalize("NFC").trim();
  return t.length > 0 ? t : null;
}

// ---------------------------------------------------------------
// TRỪ KHO KHI BẤM BILL
// ---------------------------------------------------------------

/**
 * Trừ nguyên liệu theo công thức khi đơn được bấm hoàn tất (bill).
 * Chạy trong transaction của việc đổi trạng thái đơn.
 * - Idempotent: đơn đã trừ rồi (inventory_deducted_at) thì bỏ qua.
 * - Không chặn bán hàng nếu thiếu tồn: cho phép tồn âm để cảnh báo trên UI.
 */
export async function deductStockForOrder(
  client: PoolClient,
  orderId: string,
  userId: string | null
) {
  const lock = await client.query(
    `SELECT inventory_deducted_at
     FROM orders.customer_orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (lock.rowCount === 0 || lock.rows[0].inventory_deducted_at) {
    return { skipped: true as const };
  }

  const wh = await client.query(
    `SELECT id FROM inventory.warehouses
     WHERE is_sales_warehouse = TRUE AND is_active = TRUE
     ORDER BY created_at LIMIT 1`
  );
  if (wh.rowCount === 0) {
    return { skipped: true as const };
  }
  const warehouseId = wh.rows[0].id as string;

  const need = await client.query(
    `SELECT r.item_id, SUM(oi.quantity * r.quantity_per_serving) AS qty
     FROM orders.order_items oi
     JOIN inventory.recipes r ON r.food_id = oi.food_id
     WHERE oi.order_id = $1
     GROUP BY r.item_id`,
    [orderId]
  );

  for (const row of need.rows) {
    await applyMovement(client, {
      warehouseId,
      itemId: row.item_id,
      type: "sale_out",
      quantity: -Number(row.qty),
      refType: "order",
      refId: orderId,
      reason: "Trừ kho tự động khi bấm bill",
      userId,
      allowNegative: true,
    });
  }

  await client.query(
    `UPDATE orders.customer_orders
     SET inventory_deducted_at = NOW() WHERE id = $1`,
    [orderId]
  );

  return { skipped: false as const, itemsDeducted: need.rowCount ?? 0 };
}

// ---------------------------------------------------------------
// ĐỌC DỮ LIỆU
// ---------------------------------------------------------------

export async function listWarehouses() {
  const r = await pool.query(
    `SELECT id, code, name, is_sales_warehouse
     FROM inventory.warehouses WHERE is_active = TRUE ORDER BY created_at`
  );
  return r.rows;
}

export async function listItems() {
  const r = await pool.query(
    `SELECT id, sku, name, unit, category, min_stock, last_cost
     FROM inventory.items WHERE is_active = TRUE ORDER BY name`
  );
  return r.rows;
}

export async function createItem(input: Record<string, unknown>) {
  const sku = cleanText(input.sku)?.toUpperCase();
  const name = cleanText(input.name);
  const unit = cleanText(input.unit);
  if (!sku || !name || !unit) {
    throw new InventoryError("INVALID_INPUT", "Cần mã, tên và đơn vị");
  }
  const minStock = Number(input.minStock ?? 0);
  if (!Number.isFinite(minStock) || minStock < 0) {
    throw new InventoryError("INVALID_INPUT", "Định mức tối thiểu không hợp lệ");
  }
  const r = await pool.query(
    `INSERT INTO inventory.items (sku, name, unit, category, min_stock)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (sku) DO NOTHING
     RETURNING id, sku, name, unit, category, min_stock`,
    [sku, name, unit, cleanText(input.category), minStock]
  );
  if (r.rowCount === 0) {
    throw new InventoryError("INVALID_INPUT", "Mã nguyên liệu đã tồn tại");
  }
  return r.rows[0];
}

export async function getStockOverview(warehouseId?: string) {
  const params: unknown[] = [];
  let where = "";
  if (warehouseId) {
    params.push(requireUuid(warehouseId, "Kho"));
    where = "WHERE w.id = $1";
  }
  const r = await pool.query(
    `SELECT w.id AS warehouse_id, w.name AS warehouse_name,
            i.id AS item_id, i.sku, i.name AS item_name, i.unit,
            i.min_stock, i.last_cost,
            COALESCE(s.quantity, 0) AS quantity
     FROM inventory.warehouses w
     CROSS JOIN inventory.items i
     LEFT JOIN inventory.stock s
       ON s.warehouse_id = w.id AND s.item_id = i.id
     ${where ? where + " AND" : "WHERE"} w.is_active AND i.is_active
     ORDER BY w.created_at, i.name`,
    params
  );
  return r.rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    min_stock: Number(row.min_stock),
    last_cost: Number(row.last_cost),
    status:
      Number(row.quantity) < 0
        ? "negative"
        : Number(row.quantity) <= Number(row.min_stock)
        ? "low"
        : "ok",
  }));
}

export async function listMovements(filters: {
  itemId?: string;
  warehouseId?: string;
  type?: string;
  limit?: number;
}) {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (filters.itemId) {
    params.push(requireUuid(filters.itemId, "Nguyên liệu"));
    conds.push(`m.item_id = $${params.length}`);
  }
  if (filters.warehouseId) {
    params.push(requireUuid(filters.warehouseId, "Kho"));
    conds.push(`m.warehouse_id = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    conds.push(`m.movement_type = $${params.length}`);
  }
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  params.push(limit);
  const r = await pool.query(
    `SELECT m.id, m.movement_type, m.quantity, m.balance_after, m.reason,
            m.ref_type, m.ref_id, m.created_at,
            i.name AS item_name, i.unit, w.name AS warehouse_name,
            u.email AS created_by_email
     FROM inventory.movements m
     JOIN inventory.items i ON i.id = m.item_id
     JOIN inventory.warehouses w ON w.id = m.warehouse_id
     LEFT JOIN auth.users u ON u.id = m.created_by
     ${conds.length ? "WHERE " + conds.join(" AND ") : ""}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

// ---------------------------------------------------------------
// NHẬP HÀNG / ĐẶT HÀNG
// ---------------------------------------------------------------

type LineInput = { itemId: unknown; quantity: unknown; unitCost?: unknown };

function normalizeLines(lines: unknown): {
  itemId: string;
  quantity: number;
  unitCost: number;
}[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new InventoryError("INVALID_INPUT", "Cần ít nhất 1 dòng hàng");
  }
  if (lines.length > 200) {
    throw new InventoryError("INVALID_INPUT", "Quá nhiều dòng hàng");
  }
  return (lines as LineInput[]).map((l) => {
    const unitCost = Number(l.unitCost ?? 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new InventoryError("INVALID_INPUT", "Đơn giá không hợp lệ");
    }
    return {
      itemId: requireUuid(l.itemId, "Nguyên liệu"),
      quantity: parsePositive(l.quantity, "Số lượng"),
      unitCost,
    };
  });
}

async function receivePurchaseOrder(
  client: PoolClient,
  poId: string,
  userId: string
) {
  const po = await client.query(
    `SELECT id, warehouse_id, status FROM inventory.purchase_orders
     WHERE id = $1 FOR UPDATE`,
    [poId]
  );
  if (po.rowCount === 0) throw new InventoryError("NOT_FOUND", "Không thấy đơn đặt");
  if (po.rows[0].status !== "ordered") {
    throw new InventoryError("INVALID_STATE", "Đơn này không còn ở trạng thái chờ nhận");
  }
  const items = await client.query(
    `SELECT item_id, quantity, unit_cost
     FROM inventory.purchase_order_items WHERE po_id = $1`,
    [poId]
  );
  for (const it of items.rows) {
    await applyMovement(client, {
      warehouseId: po.rows[0].warehouse_id,
      itemId: it.item_id,
      type: "purchase_in",
      quantity: Number(it.quantity),
      refType: "purchase_order",
      refId: poId,
      reason: "Nhập hàng từ đơn đặt",
      userId,
    });
    if (Number(it.unit_cost) > 0) {
      await client.query(
        `UPDATE inventory.items SET last_cost = $2, updated_at = NOW() WHERE id = $1`,
        [it.item_id, it.unit_cost]
      );
    }
  }
  await client.query(
    `UPDATE inventory.purchase_orders
     SET status = 'received', received_by = $2, received_at = NOW()
     WHERE id = $1`,
    [poId, userId]
  );
}

/**
 * Tạo đơn đặt hàng NCC. receiveNow = true → hàng đã về, tự cộng vào tồn kho
 * ngay trong cùng transaction (dùng cho màn "Nhập hàng").
 */
export async function createPurchaseOrder(
  input: Record<string, unknown>,
  userId: string
) {
  const supplier = cleanText(input.supplierName);
  if (!supplier) throw new InventoryError("INVALID_INPUT", "Cần tên nhà cung cấp");
  const warehouseId = requireUuid(input.warehouseId, "Kho nhận");
  const lines = normalizeLines(input.items);
  const receiveNow = input.receiveNow === true;
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  return inTransaction(async (client) => {
    const wh = await client.query(
      `SELECT 1 FROM inventory.warehouses WHERE id = $1 AND is_active`,
      [warehouseId]
    );
    if (wh.rowCount === 0) throw new InventoryError("NOT_FOUND", "Không thấy kho");

    const po = await client.query(
      `INSERT INTO inventory.purchase_orders
         (po_code, supplier_name, warehouse_id, note, total_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, po_code`,
      [makeCode("PO"), supplier, warehouseId, cleanText(input.note), total, userId]
    );
    const poId = po.rows[0].id as string;

    for (const l of lines) {
      await client.query(
        `INSERT INTO inventory.purchase_order_items
           (po_id, item_id, quantity, unit_cost) VALUES ($1,$2,$3,$4)`,
        [poId, l.itemId, l.quantity, l.unitCost]
      );
    }

    if (receiveNow) {
      await receivePurchaseOrder(client, poId, userId);
    }

    return { id: poId, poCode: po.rows[0].po_code, received: receiveNow };
  });
}

export async function receivePurchaseOrderById(poId: string, userId: string) {
  requireUuid(poId, "Đơn đặt");
  return inTransaction((client) => receivePurchaseOrder(client, poId, userId));
}

export async function cancelPurchaseOrder(poId: string) {
  requireUuid(poId, "Đơn đặt");
  const r = await pool.query(
    `UPDATE inventory.purchase_orders SET status = 'cancelled'
     WHERE id = $1 AND status = 'ordered' RETURNING id`,
    [poId]
  );
  if (r.rowCount === 0) {
    throw new InventoryError("INVALID_STATE", "Chỉ huỷ được đơn đang chờ nhận");
  }
}

export async function listPurchaseOrders() {
  const r = await pool.query(
    `SELECT po.id, po.po_code, po.supplier_name, po.status, po.note,
            po.total_amount, po.created_at, po.received_at,
            w.name AS warehouse_name,
            (SELECT json_agg(json_build_object(
                'item_name', i.name, 'unit', i.unit,
                'quantity', poi.quantity, 'unit_cost', poi.unit_cost))
             FROM inventory.purchase_order_items poi
             JOIN inventory.items i ON i.id = poi.item_id
             WHERE poi.po_id = po.id) AS items
     FROM inventory.purchase_orders po
     JOIN inventory.warehouses w ON w.id = po.warehouse_id
     ORDER BY po.created_at DESC LIMIT 100`
  );
  return r.rows;
}

// ---------------------------------------------------------------
// ĐIỀU CHUYỂN KHO
// ---------------------------------------------------------------

export async function createTransfer(
  input: Record<string, unknown>,
  userId: string
) {
  const fromId = requireUuid(input.fromWarehouseId, "Kho xuất");
  const toId = requireUuid(input.toWarehouseId, "Kho nhận");
  if (fromId === toId) {
    throw new InventoryError("INVALID_INPUT", "Kho xuất và kho nhận phải khác nhau");
  }
  const lines = normalizeLines(input.items);

  return inTransaction(async (client) => {
    const t = await client.query(
      `INSERT INTO inventory.transfers
         (transfer_code, from_warehouse_id, to_warehouse_id, note, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, transfer_code`,
      [makeCode("DC"), fromId, toId, cleanText(input.note), userId]
    );
    const transferId = t.rows[0].id as string;

    for (const l of lines) {
      await client.query(
        `INSERT INTO inventory.transfer_items (transfer_id, item_id, quantity)
         VALUES ($1,$2,$3)`,
        [transferId, l.itemId, l.quantity]
      );
      await applyMovement(client, {
        warehouseId: fromId,
        itemId: l.itemId,
        type: "transfer_out",
        quantity: -l.quantity,
        refType: "transfer",
        refId: transferId,
        reason: cleanText(input.note),
        userId,
      });
      await applyMovement(client, {
        warehouseId: toId,
        itemId: l.itemId,
        type: "transfer_in",
        quantity: l.quantity,
        refType: "transfer",
        refId: transferId,
        reason: cleanText(input.note),
        userId,
      });
    }
    return { id: transferId, transferCode: t.rows[0].transfer_code };
  });
}

export async function listTransfers() {
  const r = await pool.query(
    `SELECT t.id, t.transfer_code, t.note, t.created_at,
            wf.name AS from_name, wt.name AS to_name,
            u.email AS created_by_email,
            (SELECT json_agg(json_build_object(
                'item_name', i.name, 'unit', i.unit, 'quantity', ti.quantity))
             FROM inventory.transfer_items ti
             JOIN inventory.items i ON i.id = ti.item_id
             WHERE ti.transfer_id = t.id) AS items
     FROM inventory.transfers t
     JOIN inventory.warehouses wf ON wf.id = t.from_warehouse_id
     JOIN inventory.warehouses wt ON wt.id = t.to_warehouse_id
     LEFT JOIN auth.users u ON u.id = t.created_by
     ORDER BY t.created_at DESC LIMIT 100`
  );
  return r.rows;
}

// ---------------------------------------------------------------
// HUỶ HÀNG (hao hụt, hư hỏng, hết hạn)
// ---------------------------------------------------------------

export async function createWaste(
  input: Record<string, unknown>,
  userId: string
) {
  const warehouseId = requireUuid(input.warehouseId, "Kho");
  const reason = cleanText(input.reason);
  if (!reason) throw new InventoryError("INVALID_INPUT", "Cần nhập lý do huỷ hàng");
  const lines = normalizeLines(input.items);

  return inTransaction(async (client) => {
    for (const l of lines) {
      await applyMovement(client, {
        warehouseId,
        itemId: l.itemId,
        type: "waste",
        quantity: -l.quantity,
        refType: "waste",
        reason,
        userId,
      });
    }
    return { count: lines.length };
  });
}

// ---------------------------------------------------------------
// CÔNG THỨC MÓN
// ---------------------------------------------------------------

export async function listFoodsWithRecipe() {
  const r = await pool.query(
    `SELECT f.id, f.name,
            COALESCE((SELECT json_agg(json_build_object(
                'item_id', r.item_id, 'item_name', i.name, 'unit', i.unit,
                'quantity_per_serving', r.quantity_per_serving)
                ORDER BY i.name)
              FROM inventory.recipes r
              JOIN inventory.items i ON i.id = r.item_id
              WHERE r.food_id = f.id), '[]'::json) AS recipe
     FROM menu.foods f
     WHERE f.deleted_at IS NULL
     ORDER BY f.name`
  );
  return r.rows;
}

export async function saveRecipe(foodId: string, lines: unknown) {
  requireUuid(foodId, "Món ăn");
  if (!Array.isArray(lines) || lines.length > 50) {
    throw new InventoryError("INVALID_INPUT", "Công thức không hợp lệ");
  }
  const clean = (lines as LineInput[]).map((l) => ({
    itemId: requireUuid(l.itemId, "Nguyên liệu"),
    quantity: parsePositive(l.quantity, "Định lượng"),
  }));
  const seen = new Set(clean.map((c) => c.itemId));
  if (seen.size !== clean.length) {
    throw new InventoryError("INVALID_INPUT", "Có nguyên liệu bị lặp");
  }
  return inTransaction(async (client) => {
    const food = await client.query(
      `SELECT 1 FROM menu.foods WHERE id = $1 AND deleted_at IS NULL`,
      [foodId]
    );
    if (food.rowCount === 0) throw new InventoryError("NOT_FOUND", "Không thấy món");
    await client.query(`DELETE FROM inventory.recipes WHERE food_id = $1`, [foodId]);
    for (const c of clean) {
      await client.query(
        `INSERT INTO inventory.recipes (food_id, item_id, quantity_per_serving)
         VALUES ($1,$2,$3)`,
        [foodId, c.itemId, c.quantity]
      );
    }
    return { count: clean.length };
  });
}
