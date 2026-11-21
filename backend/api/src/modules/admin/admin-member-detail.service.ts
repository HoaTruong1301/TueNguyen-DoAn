
import pool from "../../database/postgres";

export async function getAdminMemberDetail(userId: string) {
  const client = await pool.connect();

  try {
    // 1. Thông tin tài khoản và hồ sơ cá nhân
    const memberResult = await client.query(
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
        u.locked_until
      FROM auth.users u
      LEFT JOIN member.user_profiles p
        ON p.user_id = u.id
      WHERE u.id = $1
        AND u.deleted_at IS NULL
      LIMIT 1
      `,
      [userId]
    );

    if (memberResult.rows.length === 0) {
      return null;
    }

    // 2. Danh sách địa chỉ giao hàng
    const addressesResult = await client.query(
      `
      SELECT
        id,
        recipient_name,
        phone,
        address_line,
        ward,
        district,
        province,
        latitude,
        longitude,
        is_default,
        created_at,
        updated_at
      FROM member.user_addresses
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
      `,
      [userId]
    );

    // 3. Tài khoản điểm tích lũy
    const loyaltyResult = await client.query(
      `
      SELECT
        id,
        points_balance,
        lifetime_earned,
        lifetime_spent,
        tier,
        created_at,
        updated_at
      FROM member.loyalty_accounts
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    // 4. Lịch sử giao dịch điểm
    const pointTransactionsResult = await client.query(
      `
      SELECT
        id,
        order_id,
        transaction_type,
        points,
        balance_after,
        description,
        created_at
      FROM member.loyalty_point_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    
    // 5. Lịch sử đơn hàng kèm chi tiết món ăn
    const ordersResult = await client.query(
      `
      SELECT
        o.id,
        o.order_code,
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
        o.voucher_id,
        o.voucher_code,
        o.confirmed_at,
        o.completed_at,
        o.cancelled_at,
        o.created_at,
        v.name AS voucher_name,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', oi.id,
                'food_id', oi.food_id,
                'food_name', oi.food_name_snapshot,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'discount_amount', oi.discount_amount,
                'line_total', oi.line_total,
                'note', oi.note
              )
              ORDER BY oi.created_at ASC
            )
            FROM orders.order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::json
        ) AS items

      FROM orders.customer_orders o
      LEFT JOIN promotion.vouchers v
        ON v.id = o.voucher_id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT 10
      `,
      [userId]
    );


    // 6. Lịch sử voucher đã sử dụng
    const usedVouchersResult = await client.query(
      `
      SELECT
        h.id,
        h.voucher_id,
        v.code,
        v.name,
        v.discount_type,
        v.discount_value,
        h.discount_amount,
        h.order_id,
        o.order_code,
        h.used_at
      FROM promotion.voucher_usage_history h
      LEFT JOIN promotion.vouchers v
        ON v.id = h.voucher_id
      LEFT JOIN orders.customer_orders o
        ON o.id = h.order_id
      WHERE h.user_id = $1
      ORDER BY h.used_at DESC
      `,
      [userId]
    );

    // 7. Voucher thưởng sinh nhật đã được cấp
    const birthdayRewardsResult = await client.query(
      `
      SELECT
        br.id,
        br.reward_year,
        br.reward_type,
        br.voucher_id,
        br.points,
        br.description,
        br.status,
        br.issued_at,
        br.used_at,
        br.expires_at,
        br.created_at,
        v.code AS voucher_code,
        v.name AS voucher_name,
        v.discount_type,
        v.discount_value,
        v.max_discount_amount,
        v.min_order_amount,
        v.starts_at,
        v.ends_at,
        v.is_active
      FROM member.birthday_rewards br
      LEFT JOIN promotion.vouchers v
        ON v.id = br.voucher_id
      WHERE br.user_id = $1
      ORDER BY br.created_at DESC
      `,
      [userId]
    );


    // 8. Thống kê tổng quan khách hàng
    const statisticsResult = await client.query(
      `
      SELECT
        COUNT(*) AS total_orders,

        COUNT(*) FILTER (
          WHERE status = 'completed'
        ) AS completed_orders,

        COUNT(*) FILTER (
          WHERE status IN (
            'pending',
            'confirmed',
            'ready',
            'out_for_delivery'
          )
        ) AS processing_orders,

        COUNT(*) FILTER (
          WHERE status = 'delivered'
        ) AS delivered_orders,

        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        ) AS cancelled_orders,

        COALESCE(
          SUM(grand_total) FILTER (
            WHERE status = 'completed'
          ),
          0
        ) AS total_spent,

        COALESCE(
          AVG(grand_total) FILTER (
            WHERE status = 'completed'
          ),
          0
        ) AS average_order_value,

        MAX(created_at) AS last_order_at

      FROM orders.customer_orders
      WHERE user_id = $1
      `,
      [userId]
    );


    return {
      member: memberResult.rows[0],
      statistics: statisticsResult.rows[0],
      addresses: addressesResult.rows,
      loyalty: loyaltyResult.rows[0] || null,
      pointTransactions: pointTransactionsResult.rows,
      orders: ordersResult.rows,
      usedVouchers: usedVouchersResult.rows,
      birthdayRewards: birthdayRewardsResult.rows,
    };
  } finally {
    client.release();
  }
}
