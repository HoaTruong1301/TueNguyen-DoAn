
import pool from "../../database/postgres";

export async function getDashboardOverview() {
  const result = await pool.query(`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM auth.users
        WHERE deleted_at IS NULL
      ) AS total_members,

      (
        SELECT COUNT(*)::int
        FROM orders.customer_orders
      ) AS total_orders,

      (
        SELECT COUNT(*)::int
        FROM orders.customer_orders
        WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')
      ) AS processing_orders,

      (
        SELECT COALESCE(SUM(grand_total), 0)::numeric
        FROM orders.customer_orders
        WHERE status = 'completed'
      ) AS completed_revenue,

      (
        SELECT COUNT(*)::int
        FROM orders.customer_orders
        WHERE status = 'completed'
      ) AS completed_orders,

      (
        SELECT COUNT(*)::int
        FROM orders.customer_orders
        WHERE status = 'cancelled'
      ) AS cancelled_orders
  `);

  const revenueResult = await pool.query(`
    SELECT
      TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
      COALESCE(SUM(orders.grand_total), 0)::numeric AS revenue
    FROM (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS day
    ) days
    LEFT JOIN orders.customer_orders orders
      ON orders.completed_at >= days.day
      AND orders.completed_at < days.day + INTERVAL '1 day'
      AND orders.status = 'completed'
    GROUP BY days.day
    ORDER BY days.day ASC
  `);

  const row = result.rows[0];

  return {
    totalMembers: row.total_members,
    totalOrders: row.total_orders,
    processingOrders: row.processing_orders,
    completedRevenue: row.completed_revenue,
    completedOrders: row.completed_orders,
    cancelledOrders: row.cancelled_orders,

    revenueByDay: revenueResult.rows.map((item) => ({
      date: item.date,
      revenue: Number(item.revenue),
    })),
  };
}
