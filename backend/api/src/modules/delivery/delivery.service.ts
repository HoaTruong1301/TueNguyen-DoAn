import pool from "../../database/postgres";
import { createDeliveryNotification } from "../notification/notification.service";
import { sendPushNotification } from "../notification/push.service";

export type DeliveryStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "cancelled";

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  picked_up: ["out_for_delivery", "failed"],
  out_for_delivery: ["delivered", "failed"],
  delivered: [],
  failed: ["assigned", "cancelled"],
  cancelled: []
};

function normalizePagination(page: number, limit: number) {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit
  };
}

// Khách hàng: danh sách đơn giao hàng của mình.
export async function getMyDeliveryOrders(
  userId: string,
  page: number,
  limit: number
) {
  const pagination = normalizePagination(page, limit);

  const result = await pool.query(
    `SELECT
       d.id,
       d.order_id,
       o.order_code,
       d.recipient_name,
       d.recipient_phone,
       d.address_snapshot,
       d.status,
       d.driver_name,
       d.driver_phone,
       d.delivery_fee,
       d.assigned_at,
       d.picked_up_at,
       d.out_for_delivery_at,
       d.delivered_at,
       d.failed_at,
       d.cancelled_at,
       d.created_at,
       d.updated_at
     FROM delivery.delivery_orders d
     INNER JOIN orders.customer_orders o
       ON o.id = d.order_id
     WHERE o.user_id = $1
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, pagination.limit, pagination.offset]
  );

  return {
    data: result.rows,
    page: pagination.page,
    limit: pagination.limit
  };
}

// Khách hàng: chi tiết giao hàng và lịch sử trạng thái.
export async function getMyDeliveryDetail(
  userId: string,
  orderId: string
) {
  const deliveryResult = await pool.query(
    `SELECT
       d.*,
       o.order_code,
       o.status AS order_status,
       o.grand_total
     FROM delivery.delivery_orders d
     INNER JOIN orders.customer_orders o
       ON o.id = d.order_id
     WHERE d.order_id = $1
       AND o.user_id = $2`,
    [orderId, userId]
  );

  if (deliveryResult.rows.length === 0) {
    return null;
  }

  const delivery = deliveryResult.rows[0];

  const historyResult = await pool.query(
    `SELECT
       old_status,
       new_status,
       note,
       created_at
     FROM delivery.delivery_status_history
     WHERE delivery_order_id = $1
     ORDER BY created_at ASC`,
    [delivery.id]
  );

  return {
    ...delivery,
    statusHistory: historyResult.rows
  };
}

// Khách hàng: xem lịch sử vị trí giao hàng của đơn mình.
export async function getMyDeliveryTracking(
  userId: string,
  orderId: string
) {
  const deliveryResult = await pool.query(
    `SELECT d.id, d.status
     FROM delivery.delivery_orders d
     INNER JOIN orders.customer_orders o
       ON o.id = d.order_id
     WHERE d.order_id = $1
       AND o.user_id = $2`,
    [orderId, userId]
  );

  if (deliveryResult.rows.length === 0) {
    return null;
  }

  const delivery = deliveryResult.rows[0];

  const trackingResult = await pool.query(
    `SELECT latitude, longitude, recorded_at
     FROM delivery.delivery_tracking
     WHERE delivery_order_id = $1
     ORDER BY recorded_at ASC`,
    [delivery.id]
  );

  return {
    deliveryId: delivery.id,
    status: delivery.status,
    tracking: trackingResult.rows
  };
}

// Admin: danh sách đơn giao hàng.
export async function getAdminDeliveryOrders(
  page: number,
  limit: number,
  status?: DeliveryStatus
) {
  const pagination = normalizePagination(page, limit);

  const result = await pool.query(
    `SELECT
       d.id,
       d.order_id,
       o.order_code,
       o.user_id,
       o.customer_name,
       o.customer_phone,
       o.grand_total,
       d.recipient_name,
       d.recipient_phone,
       d.address_snapshot,
       d.status,
       d.driver_name,
       d.driver_phone,
       d.delivery_fee,
       d.created_at,
       d.updated_at
     FROM delivery.delivery_orders d
     INNER JOIN orders.customer_orders o
       ON o.id = d.order_id
     WHERE ($1::text IS NULL OR d.status = $1)
     ORDER BY d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, pagination.limit, pagination.offset]
  );

  return {
    data: result.rows,
    page: pagination.page,
    limit: pagination.limit
  };
}

// Admin: phân công hoặc thay đổi người giao hàng.
export async function assignDelivery(
  orderId: string,
  driverName: string,
  driverPhone: string,
  changedBy: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa đơn hàng trước để đồng nhất thứ tự khóa.
    const orderResult = await client.query(
      `SELECT id, user_id
      FROM orders.customer_orders
      WHERE id = $1
      FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const customerUserId: string = orderResult.rows[0].user_id;

    const result = await client.query(
      `SELECT id, status
      FROM delivery.delivery_orders
      WHERE order_id = $1
      FOR UPDATE`,
      [orderId]
    );

    if (result.rows.length === 0) {
      throw new Error("DELIVERY_NOT_FOUND");
    }

    const delivery = result.rows[0];
    const oldStatus = delivery.status as DeliveryStatus;

    if (!["pending", "assigned", "failed"].includes(oldStatus)) {
      throw new Error("DELIVERY_CANNOT_BE_ASSIGNED");
    }

    const normalizedName = driverName.trim();
    const normalizedPhone = driverPhone.trim();

    if (!normalizedName || !normalizedPhone) {
      throw new Error("DRIVER_INFO_REQUIRED");
    }

    await client.query(
      `UPDATE delivery.delivery_orders
       SET driver_name = $2,
           driver_phone = $3,
           status = 'assigned',
           assigned_at = COALESCE(assigned_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [delivery.id, normalizedName, normalizedPhone]
    );

    await client.query(
      `INSERT INTO delivery.delivery_status_history (
         delivery_order_id,
         old_status,
         new_status,
         changed_by,
         note
       )
       VALUES ($1, $2, 'assigned', $3, $4)`,
      [
        delivery.id,
        oldStatus,
        changedBy,
        oldStatus === "assigned"
          ? "Cập nhật thông tin người giao hàng"
          : "Phân công người giao hàng"
      ]
    );

    // Thông báo khách hàng đã có người giao hàng.
    const notificationId = await createDeliveryNotification(
      customerUserId,
      orderId,
      "assigned",
      client
    );
    

    await client.query("COMMIT");

    await sendPushNotification(
      customerUserId,
      "Đơn hàng đã có người giao",
      `Người giao hàng: ${normalizedName}`,
      {
        type: "delivery_status",
        orderId,
        status: "assigned",
        ...(notificationId ? { notificationId } : {})
      }
    );

    return {
      orderId,
      status: "assigned",
      driverName: normalizedName,
      driverPhone: normalizedPhone
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Admin: cập nhật trạng thái giao hàng.
export async function updateDeliveryStatus(
  orderId: string,
  newStatus: DeliveryStatus,
  changedBy: string,
  note?: string
) {
  const client = await pool.connect();

  try {
  await client.query("BEGIN");

  // Khi giao hàng thành công, khóa đơn hàng trước
  // để đồng bộ trạng thái an toàn.
  const orderResult = await client.query(
  `SELECT id, user_id, status
   FROM orders.customer_orders
   WHERE id = $1
   FOR UPDATE`,
  [orderId]
);

if (orderResult.rows.length === 0) {
  throw new Error("ORDER_NOT_FOUND");
}

const customerOrderStatus: string = orderResult.rows[0].status;
const customerUserId: string = orderResult.rows[0].user_id;

  const result = await client.query(
      `SELECT id, status
       FROM delivery.delivery_orders
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (result.rows.length === 0) {
      throw new Error("DELIVERY_NOT_FOUND");
    }

    const delivery = result.rows[0];
    const oldStatus = delivery.status as DeliveryStatus;

    if (!allowedTransitions[oldStatus]?.includes(newStatus)) {
      throw new Error("DELIVERY_INVALID_STATUS_TRANSITION");
    }

    const timestampColumn: Partial<Record<DeliveryStatus, string>> = {
      picked_up: "picked_up_at",
      out_for_delivery: "out_for_delivery_at",
      delivered: "delivered_at",
      failed: "failed_at",
      cancelled: "cancelled_at"
    };

    const timestampColumnName = timestampColumn[newStatus];

    const timestampUpdate = timestampColumnName
      ? `, ${timestampColumnName} = NOW()`
      : "";

    await client.query(
      `UPDATE delivery.delivery_orders
       SET status = $2,
           updated_at = NOW()
           ${timestampUpdate}
       WHERE id = $1`,
      [delivery.id, newStatus]
    );

    await client.query(
      `INSERT INTO delivery.delivery_status_history (
         delivery_order_id,
         old_status,
         new_status,
         changed_by,
         note
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        delivery.id,
        oldStatus,
        newStatus,
        changedBy,
        note?.trim() || null
      ]
    );

        // Đồng bộ đơn hàng khi giao hàng thành công.
    if (
      newStatus === "delivered" &&
      customerOrderStatus === "delivered"
    ) {
      await client.query(
        `UPDATE orders.customer_orders
         SET status = 'completed',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );

      await client.query(
        `INSERT INTO orders.order_status_history (
           order_id,
           old_status,
           new_status,
           changed_by,
           note
         )
         VALUES ($1, 'delivered', 'completed', $2, $3)`,
        [
          orderId,
          changedBy,
          "Tự động hoàn tất khi giao hàng thành công"
        ]
      );
    }

        // Tạo thông báo cho khách hàng trong cùng transaction.
    const notificationId = await createDeliveryNotification(
      customerUserId,
      orderId,
      newStatus,
      client
    );

    await client.query("COMMIT");

    const pushMessages: Record<
      DeliveryStatus,
      { title: string; body: string }
    > = {
      pending: {
        title: "Đơn hàng đang chờ xử lý",
        body: "Đơn hàng của bạn đang chờ xử lý."
      },
      assigned: {
        title: "Đơn hàng đã có người giao",
        body: "Đơn hàng của bạn đã được phân công người giao hàng."
      },
      picked_up: {
        title: "Đã lấy hàng",
        body: "Người giao hàng đã nhận đơn hàng của bạn."
      },
      out_for_delivery: {
        title: "Đơn hàng đang được giao",
        body: "Đơn hàng đang trên đường đến bạn."
      },
      delivered: {
        title: "Giao hàng thành công",
        body: "Đơn hàng của bạn đã được giao thành công."
      },
      failed: {
        title: "Giao hàng chưa thành công",
        body: "Đơn hàng chưa thể giao thành công. Vui lòng liên hệ cửa hàng."
      },
      cancelled: {
        title: "Đơn hàng đã bị hủy",
        body: "Đơn giao hàng của bạn đã bị hủy."
      }
    };

    const pushMessage = pushMessages[newStatus];

    await sendPushNotification(
      customerUserId,
      pushMessage.title,
      pushMessage.body,
      {
        type: "delivery_status",
        orderId,
        status: newStatus,
        ...(notificationId ? { notificationId } : {})
      }
    );

    return {
      orderId,
      oldStatus,
      newStatus
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Admin cập nhật vị trí người giao hàng trên bản đồ.
export async function updateDeliveryLocation(
  orderId: string,
  latitude: number,
  longitude: number
) {
  const deliveryResult = await pool.query(
    `SELECT id, status
     FROM delivery.delivery_orders
     WHERE order_id = $1`,
    [orderId]
  );

  if (deliveryResult.rows.length === 0) {
    throw new Error("DELIVERY_NOT_FOUND");
  }

  const delivery = deliveryResult.rows[0];
  const status = delivery.status as DeliveryStatus;

  if (!["picked_up", "out_for_delivery"].includes(status)) {
    throw new Error("DELIVERY_NOT_IN_PROGRESS");
  }

  const result = await pool.query(
    `INSERT INTO delivery.delivery_tracking (
       delivery_order_id,
       latitude,
       longitude
     )
     VALUES ($1, $2, $3)
     RETURNING id, latitude, longitude, recorded_at`,
    [delivery.id, latitude, longitude]
  );

  return result.rows[0];
}