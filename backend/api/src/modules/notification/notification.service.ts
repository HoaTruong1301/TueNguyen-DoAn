import pool from "../../database/postgres";


export async function getNotifications(
  userId: string,
  limit = 20,
  offset = 0
) {
  const result = await pool.query(
    `
    SELECT
      id,
      type,
      title,
      content,
      data,
      image_url,
      is_read,
      read_at,
      priority,
      published_at,
      created_at
    FROM notification.notifications
    WHERE user_id = $1
    ORDER BY published_at DESC, created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_read = false)::int AS unread_count
    FROM notification.notifications
    WHERE user_id = $1
    `,
    [userId]
  );

  return {
    notifications: result.rows,
    total: countResult.rows[0].total,
    unreadCount: countResult.rows[0].unread_count,
  };
}

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS unread_count
    FROM notification.notifications
    WHERE user_id = $1
      AND is_read = false
    `,
    [userId]
  );

  return result.rows[0].unread_count;
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE notification.notifications
    SET
      is_read = true,
      read_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND user_id = $2
      AND is_read = false
    RETURNING id
    `,
    [notificationId, userId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsAsRead(
  userId: string
): Promise<number> {
  const result = await pool.query(
    `
    UPDATE notification.notifications
    SET
      is_read = true,
      read_at = NOW(),
      updated_at = NOW()
    WHERE user_id = $1
      AND is_read = false
    RETURNING id
    `,
    [userId]
  );

  return result.rowCount ?? 0;
}


export async function createDeliveryNotification(
  userId: string,
  orderId: string,
  status: string,
  client?: import("pg").PoolClient
): Promise<string | null> {
  const messages: Record<string, { title: string; content: string }> = {
    assigned: {
      title: "Đơn hàng đã có người giao",
      content: "Đơn hàng của bạn đã được phân công người giao hàng."
    },
    picked_up: {
      title: "Người giao hàng đã nhận đơn",
      content: "Đơn hàng của bạn đã được người giao hàng tiếp nhận."
    },
    out_for_delivery: {
      title: "Đơn hàng đang được giao",
      content: "Người giao hàng đang trên đường giao đơn hàng đến bạn."
    },
    delivered: {
      title: "Giao hàng thành công",
      content: "Đơn hàng của bạn đã được giao thành công. Cảm ơn bạn!"
    },
    failed: {
      title: "Giao hàng chưa thành công",
      content: "Đơn hàng chưa được giao thành công. Vui lòng liên hệ cửa hàng để được hỗ trợ."
    },
    cancelled: {
      title: "Đơn giao hàng đã bị hủy",
      content: "Đơn giao hàng của bạn đã bị hủy."
    }
  };

  const message = messages[status];

  if (!message) return null;

  const db = client ?? pool;

  const result = await db.query<{ id: string }>(
    `INSERT INTO notification.notifications (
       user_id,
       type,
       title,
       content,
       data,
       priority
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id`,
    [
      userId,
      "delivery_status",
      message.title,
      message.content,
      JSON.stringify({ orderId, status }),
      status === "failed" ? 2 : 1
    ]
  );

  return result.rows[0]?.id ?? null;
}


export async function createOrderNotification(
  userId: string,
  orderId: string,
  status: string,
  client?: import("pg").PoolClient
): Promise<string | null> {
  const messages: Record<string, { title: string; content: string }> = {
    confirmed: {
      title: "Đơn hàng đã được xác nhận",
      content: "Cửa hàng đã xác nhận đơn hàng của bạn.",
    },
    preparing: {
      title: "Đơn hàng đang được chuẩn bị",
      content: "Cửa hàng đang chuẩn bị đơn hàng của bạn.",
    },
    ready: {
      title: "Đơn hàng đã sẵn sàng",
      content: "Đơn hàng của bạn đã sẵn sàng.",
    },
    rejected: {
      title: "Đơn hàng bị từ chối",
      content: "Rất tiếc, cửa hàng không thể tiếp nhận đơn hàng.",
    },
    cancelled: {
      title: "Đơn hàng đã bị hủy",
      content: "Đơn hàng của bạn đã bị hủy.",
    },
    delivered: {
      title: "Đơn hàng đã được giao",
      content: "Đơn hàng của bạn đã được giao thành công.",
    },
    completed: {
      title: "Đơn hàng đã hoàn tất",
      content: "Cảm ơn bạn đã đặt hàng tại Tuệ Nguyên!",
    },
  };

  const message = messages[status];

  if (!message) return null;

  const db = client ?? pool;

  const result = await db.query<{ id: string }>(
    `INSERT INTO notification.notifications (
       user_id,
       type,
       title,
       content,
       data,
       priority
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id`,
    [
      userId,
      "order_status",
      message.title,
      message.content,
      JSON.stringify({ orderId, status }),
      status === "rejected" || status === "cancelled" ? 2 : 1,
    ]
  );

  return result.rows[0]?.id ?? null;
}



export async function registerDeviceToken(
  userId: string,
  fcmToken: string,
  platform: string = "android"
): Promise<void> {
  await pool.query(
    `INSERT INTO notification.device_tokens (
       user_id,
       fcm_token,
       platform,
       updated_at
     )
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (fcm_token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       updated_at = NOW()`,
    [userId, fcmToken, platform]
  );
}