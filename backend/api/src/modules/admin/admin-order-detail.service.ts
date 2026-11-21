
import  pool  from "../../database/postgres";

export async function getAdminOrderDetail(orderId: string) {
  const orderResult = await pool.query(
    `SELECT
       o.id,
       o.order_code,
       o.user_id,
       o.reservation_id,
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
       o.cancellation_reason,
       o.rejected_reason,
       o.confirmed_at,
       o.preparing_at,
       o.ready_at,
       o.delivered_at,
       o.completed_at,
       o.cancelled_at,
       o.created_at,
       o.updated_at
     FROM orders.customer_orders o
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    return null;
  }

  const order = orderResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT
       oi.id,
       oi.food_id,
       oi.food_name_snapshot,
       oi.quantity,
       oi.unit_price,
       oi.discount_amount,
       oi.line_total,
       oi.note,
       COALESCE(
         (
           SELECT jsonb_agg(
             jsonb_build_object(
               'id', oio.id,
               'foodOptionId', oio.food_option_id,
               'group', oio.option_group_snapshot,
               'name', oio.option_name_snapshot,
               'priceAdjustment', oio.price_adjustment,
               'quantity', oio.quantity
             )
             ORDER BY oio.id
           )
           FROM orders.order_item_options oio
           WHERE oio.order_item_id = oi.id
         ),
         '[]'::jsonb
       ) AS options
     FROM orders.order_items oi
     WHERE oi.order_id = $1
     ORDER BY oi.created_at ASC`,
    [orderId]
  );

  const historyResult = await pool.query(
    `SELECT
       h.id,
       h.old_status,
       h.new_status,
       h.changed_by,
       h.note,
       h.created_at
     FROM orders.order_status_history h
     WHERE h.order_id = $1
     ORDER BY h.created_at ASC`,
    [orderId]
  );

  const paymentResult = await pool.query(
    `SELECT
       p.id,
       p.payment_method,
       p.payment_status,
       p.amount,
       p.currency,
       p.transaction_id,
       p.provider,
       p.failure_reason,
       p.paid_at,
       p.refunded_at,
       p.created_at,
       p.updated_at
     FROM orders.payments p
     WHERE p.order_id = $1
     ORDER BY p.created_at DESC`,
    [orderId]
  );

  return {
    ...order,
    items: itemsResult.rows,
    statusHistory: historyResult.rows,
    payments: paymentResult.rows,
  };
}
