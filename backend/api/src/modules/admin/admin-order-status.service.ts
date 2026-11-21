
import  pool from "../../database/postgres";
import { createOrderNotification } from "../notification/notification.service";
import { sendPushNotification } from "../notification/push.service";
import { deductStockForOrder } from "../inventory/inventory.service";

const allowedTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "rejected"],
  confirmed: ["preparing", "cancelled", "rejected"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
};

const statusTimestamps: Record<string, string> = {
  confirmed: "confirmed_at",
  preparing: "preparing_at",
  ready: "ready_at",
  delivered: "delivered_at",
  completed: "completed_at",
  cancelled: "cancelled_at",
};

export async function updateAdminOrderStatus(
  orderId: string,
  newStatus: string,
  changedBy: string,
  note?: string
) {
  const client = await pool.connect();
  const normalizedNote = normalizeNote(note);

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, user_id, status
      FROM orders.customer_orders
      WHERE id = $1
      FOR UPDATE`,
      [orderId]
    );

    if (orderResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { error: "NOT_FOUND" as const };
    }

    const oldStatus = orderResult.rows[0].status as string;
    const userId = orderResult.rows[0].user_id as string;
    const nextStatuses = allowedTransitions[oldStatus];

    if (!nextStatuses) {
      await client.query("ROLLBACK");
      return { error: "INVALID_CURRENT_STATUS" as const };
    }

    if (!nextStatuses.includes(newStatus)) {
      await client.query("ROLLBACK");
      return {
        error: "INVALID_TRANSITION" as const,
        currentStatus: oldStatus,
        allowedStatuses: nextStatuses,
      };
    }

    if (
      (newStatus === "cancelled" || newStatus === "rejected") &&
      !note?.trim()
    ) {
      await client.query("ROLLBACK");
      return { error: "REASON_REQUIRED" as const };
    }

    const timestampColumn = statusTimestamps[newStatus];
    const timestampSql = timestampColumn
      ? `, ${timestampColumn} = NOW()`
      : "";
  
    await client.query(
      `UPDATE orders.customer_orders
      SET status = $2,
          updated_at = NOW()
          ${timestampSql}
      WHERE id = $1`,
      [orderId, newStatus]
    );

    await client.query(
      `INSERT INTO orders.order_status_history
        (order_id, old_status, new_status, changed_by, note)
      VALUES ($1, $2, $3, $4, $5)`,
      [orderId, oldStatus, newStatus, changedBy, normalizedNote]
    );

    // Bấm bill (hoàn tất) → tự trừ nguyên liệu theo công thức, cùng transaction
    if (newStatus === "completed") {
      await deductStockForOrder(client, orderId, changedBy);
    }

    const notificationId = await createOrderNotification(
      userId,
      orderId,
      newStatus,
      client
    );

    await client.query("COMMIT");

    if (notificationId) {
      await sendPushNotification(
        userId,
        "Cập nhật đơn hàng",
        `Đơn hàng của bạn đã chuyển sang trạng thái: ${newStatus}`,
        {
          type: "order_status",
          orderId,
          status: newStatus,
          notificationId,
        }
      );
    }


    return {
      data: {
        orderId,
        oldStatus,
        newStatus,
      },
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Lỗi rollback transaction:", rollbackError);
    }

    if (error && typeof error === "object") {
  const dbError = error as {
    code?: string;
    message?: string;
    detail?: string;
    constraint?: string;
    table?: string;
  };

    console.error("Lỗi cập nhật trạng thái đơn hàng:", {
      code: dbError.code,
      message: dbError.message,
      detail: dbError.detail,
      constraint: dbError.constraint,
      table: dbError.table,
    });
  } else {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
  }
    throw error;
  } finally {
    client.release();
  }
}

function normalizeNote(note?: string): string | null {
  if (typeof note !== "string") {
    return null;
  }

  const normalized = note.normalize("NFC").trim();

  return normalized.length > 0 ? normalized : null;
}

