
import { randomBytes } from "crypto";
import pool from "../../database/postgres";

export interface CreateOrderInput {
  orderType: "delivery" | "pickup" | "dine_in";
  addressId?: string;
  note?: string;
  voucherCode?: string;
  paymentMethod: "cash" | "card" | "bank_transfer" | "e_wallet";
  items: {
    foodId: string;
    quantity: number;
    note?: string;
    options?: {
      optionId: string;
      quantity?: number;
    }[];
  }[];
}


async function calculateVoucherDiscount(
  client: import("pg").PoolClient,
  userId: string,
  voucherCode: string,
  subtotal: number,
  items: {
    foodId: string;
    categoryId: string;
    quantity: number;
    lineTotal: number;
  }[]
) {
  const code = voucherCode.trim().toUpperCase();

  if (!code) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  // Khóa Voucher để tránh nhiều đơn hàng đồng thời
  // sử dụng vượt quá giới hạn.
  const voucherResult = await client.query(
    `SELECT *
     FROM promotion.vouchers
     WHERE UPPER(code) = $1
     FOR UPDATE`,
    [code]
  );

  if (voucherResult.rowCount === 0) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  const voucher = voucherResult.rows[0];

  if (!voucher.is_active) {
    throw new Error("VOUCHER_INACTIVE");
  }

  const now = Date.now();

  if (new Date(voucher.starts_at).getTime() > now) {
    throw new Error("VOUCHER_NOT_STARTED");
  }

  if (new Date(voucher.ends_at).getTime() <= now) {
    throw new Error("VOUCHER_EXPIRED");
  }

  if (
    voucher.usage_limit !== null &&
    Number(voucher.used_count) >= Number(voucher.usage_limit)
  ) {
    throw new Error("VOUCHER_USAGE_LIMIT_REACHED");
  }

  if (subtotal < Number(voucher.min_order_amount)) {
    throw new Error("VOUCHER_MIN_ORDER_NOT_MET");
  }

  // Kiểm tra giới hạn sử dụng theo khách hàng.
  await client.query(
    `INSERT INTO promotion.voucher_user_limits (
       voucher_id,
       user_id,
       usage_count
     )
     VALUES ($1, $2, 0)
     ON CONFLICT (voucher_id, user_id) DO NOTHING`,
    [voucher.id, userId]
  );

  const userLimitResult = await client.query(
    `SELECT usage_count
     FROM promotion.voucher_user_limits
     WHERE voucher_id = $1
       AND user_id = $2
     FOR UPDATE`,
    [voucher.id, userId]
  );

  const userUsageCount = Number(
    userLimitResult.rows[0].usage_count
  );

  if (
    voucher.per_user_limit !== null &&
    userUsageCount >= Number(voucher.per_user_limit)
  ) {
    throw new Error("VOUCHER_USER_LIMIT_REACHED");
  }

  // Lấy danh sách món và danh mục được áp dụng.
  const [foodsResult, categoriesResult] = await Promise.all([
    client.query(
      `SELECT food_id
       FROM promotion.voucher_foods
       WHERE voucher_id = $1`,
      [voucher.id]
    ),
    client.query(
      `SELECT category_id
       FROM promotion.voucher_categories
       WHERE voucher_id = $1`,
      [voucher.id]
    )
  ]);

  const allowedFoodIds = new Set(
    foodsResult.rows.map((row) => row.food_id)
  );

  const allowedCategoryIds = new Set(
    categoriesResult.rows.map((row) => row.category_id)
  );

  const hasRestrictions =
    allowedFoodIds.size > 0 || allowedCategoryIds.size > 0;

  // Nếu có giới hạn, món được áp dụng khi khớp món
  // hoặc khớp danh mục được cấu hình.
  const eligibleItems = hasRestrictions
    ? items.filter(
        (item) =>
          allowedFoodIds.has(item.foodId) ||
          allowedCategoryIds.has(item.categoryId)
      )
    : items;

  if (eligibleItems.length === 0) {
    throw new Error("VOUCHER_NOT_APPLICABLE");
  }

  const eligibleSubtotal = eligibleItems.reduce(
    (total, item) => total + item.lineTotal,
    0
  );

  let discount = 0;

  if (voucher.discount_type === "percentage") {
    discount =
      eligibleSubtotal * Number(voucher.discount_value) / 100;

    if (voucher.max_discount_amount !== null) {
      discount = Math.min(
        discount,
        Number(voucher.max_discount_amount)
      );
    }
  } else if (voucher.discount_type === "fixed_amount") {
    discount = Number(voucher.discount_value);
  } else {
    throw new Error("VOUCHER_INVALID_DISCOUNT_TYPE");
  }

  discount = Math.round(
    Math.min(discount, eligibleSubtotal, subtotal) * 100
  ) / 100;

  if (discount <= 0) {
    throw new Error("VOUCHER_NO_DISCOUNT");
  }

  return {
    voucherId: voucher.id as string,
    voucherCode: voucher.code as string,
    discountTotal: discount
  };
}


export async function createOrder(
  userId: string,
  input: CreateOrderInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lấy thông tin khách hàng từ database.
    const userResult = await client.query(
      `SELECT
         u.id,
         u.email,
         u.phone,
         p.full_name,
         p.phone_number
       FROM auth.users u
       LEFT JOIN member.user_profiles p
         ON p.user_id = u.id
       WHERE u.id = $1
         AND u.deleted_at IS NULL`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const user = userResult.rows[0];

    let customerName = user.full_name;
    let customerPhone = user.phone_number || user.phone;
    let addressSnapshot: Record<string, unknown> | null = null;

    if (input.orderType === "delivery") {
      if (!input.addressId) {
        throw new Error("DELIVERY_ADDRESS_REQUIRED");
      }

      const addressResult = await client.query(
        `SELECT
           id,
           recipient_name,
           phone,
           address_line,
           ward,
           district,
           province,
           latitude,
           longitude
         FROM member.user_addresses
         WHERE id = $1
           AND user_id = $2`,
        [input.addressId, userId]
      );

      if (addressResult.rowCount === 0) {
        throw new Error("ADDRESS_NOT_FOUND");
      }

      const address = addressResult.rows[0];

      customerName = address.recipient_name;
      customerPhone = address.phone;

      addressSnapshot = {
        addressId: address.id,
        recipientName: address.recipient_name,
        phone: address.phone,
        addressLine: address.address_line,
        ward: address.ward,
        district: address.district,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude
      };
    }

    if (!customerName?.trim() || !customerPhone?.trim()) {
      throw new Error("CUSTOMER_INFO_REQUIRED");
    }

    let subtotal = 0;
    const preparedItems: {
      foodId: string;
      name: string;
      categoryId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      note: string | null;
      options: {
        optionId: string;
        group: string;
        name: string;
        priceAdjustment: number;
        quantity: number;
      }[];
    }[] = [];

    // Lấy giá và tùy chọn trực tiếp từ database.
    for (const item of input.items) {
      const foodResult = await client.query(
        `SELECT id, category_id, name, price, sale_price
        FROM menu.foods
         WHERE id = $1
           AND status = 'available'
           AND deleted_at IS NULL
         FOR SHARE`,
        [item.foodId]
      );

      if (foodResult.rowCount === 0) {
        throw new Error("FOOD_NOT_AVAILABLE");
      }

      const food = foodResult.rows[0];

      const unitPrice = Number(
        food.sale_price !== null &&
        Number(food.sale_price) < Number(food.price)
          ? food.sale_price
          : food.price
      );

      const preparedOptions = [];
      let optionTotal = 0;

      for (const selectedOption of item.options ?? []) {
        const optionResult = await client.query(
          `SELECT id, food_id, option_group, name, price_adjustment
           FROM menu.food_options
           WHERE id = $1
             AND food_id = $2
             AND is_available = TRUE
           FOR SHARE`,
          [selectedOption.optionId, food.id]
        );

        if (optionResult.rowCount === 0) {
          throw new Error("FOOD_OPTION_NOT_AVAILABLE");
        }

        const option = optionResult.rows[0];
        const optionQuantity = selectedOption.quantity ?? 1;
        const adjustment = Number(option.price_adjustment);

        optionTotal += adjustment * optionQuantity;

        preparedOptions.push({
          optionId: option.id,
          group: option.option_group,
          name: option.name,
          priceAdjustment: adjustment,
          quantity: optionQuantity
        });
      }

      const lineTotal =
        (unitPrice + optionTotal) * item.quantity;

      subtotal += lineTotal;

      preparedItems.push({
        foodId: food.id,
        categoryId: food.category_id,
        name: food.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        note: item.note?.trim() || null,
        options: preparedOptions
      });
    }

    
    let voucherId: string | null = null;
    let appliedVoucherCode: string | null = null;
    let discountTotal = 0;

    if (input.voucherCode?.trim()) {
      const voucherResult = await calculateVoucherDiscount(
        client,
        userId,
        input.voucherCode,
        subtotal,
        preparedItems
      );

      voucherId = voucherResult.voucherId;
      appliedVoucherCode = voucherResult.voucherCode;
      discountTotal = voucherResult.discountTotal;
    }

    const deliveryFee = 0;
    const taxTotal = 0;

    const grandTotal =
      subtotal - discountTotal + deliveryFee + taxTotal;

    const orderCode =
      `TN-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    
    const orderResult = await client.query(
      `INSERT INTO orders.customer_orders (
        order_code,
        user_id,
        voucher_id,
        voucher_code,
        order_type,
        source,
        customer_name,
        customer_phone,
        customer_email,
        note,
        delivery_address_snapshot,
        subtotal,
        discount_total,
        delivery_fee,
        tax_total,
        grand_total,
        currency,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, 'app', $6, $7, $8, $9,
        $10::jsonb, $11, $12, $13, $14, $15, 'VND', 'pending'
      )
      RETURNING id, order_code, status, grand_total, created_at`,
      [
        orderCode,
        userId,
        voucherId,
        appliedVoucherCode,
        input.orderType,
        customerName.trim(),
        customerPhone.trim(),
        user.email,
        input.note?.trim() || null,
        addressSnapshot ? JSON.stringify(addressSnapshot) : null,
        subtotal,
        discountTotal,
        deliveryFee,
        taxTotal,
        grandTotal
      ]
    );

// Ghi nhận lượt sử dụng Voucher trong cùng transaction.
    if (voucherId && appliedVoucherCode) {
      const orderId = orderResult.rows[0].id;

      await client.query(
        `INSERT INTO promotion.voucher_usage_history (
          voucher_id,
          user_id,
          order_id,
          discount_amount
        )
        VALUES ($1, $2, $3, $4)`,
        [
          voucherId,
          userId,
          orderId,
          discountTotal
        ]
      );

      await client.query(
        `UPDATE promotion.vouchers
        SET used_count = used_count + 1,
            updated_at = NOW()
        WHERE id = $1`,
        [voucherId]
      );

      await client.query(
        `UPDATE promotion.voucher_user_limits
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE voucher_id = $1
          AND user_id = $2`,
        [voucherId, userId]
      );
    }



    const order = orderResult.rows[0];

    for (const item of preparedItems) {
      const itemResult = await client.query(
        `INSERT INTO orders.order_items (
           order_id,
           food_id,
           food_name_snapshot,
           quantity,
           unit_price,
           discount_amount,
           line_total,
           note
         )
         VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
         RETURNING id`,
        [
          order.id,
          item.foodId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.note
        ]
      );

      const orderItemId = itemResult.rows[0].id;

      for (const option of item.options) {
        await client.query(
          `INSERT INTO orders.order_item_options (
             order_item_id,
             food_option_id,
             option_group_snapshot,
             option_name_snapshot,
             price_adjustment,
             quantity
           )
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            orderItemId,
            option.optionId,
            option.group,
            option.name,
            option.priceAdjustment,
            option.quantity
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO orders.order_status_history (
         order_id,
         old_status,
         new_status,
         changed_by,
         note
       )
       VALUES ($1, NULL, 'pending', $2, 'Khách hàng tạo đơn')`,
      [order.id, userId]
    );

    // Tạo bản ghi giao hàng cho đơn delivery.
    if (input.orderType === "delivery" && addressSnapshot) {
      const deliveryResult = await client.query(
        `INSERT INTO delivery.delivery_orders (
           order_id,
           recipient_name,
           recipient_phone,
           address_snapshot,
           status,
           delivery_fee
         )
         VALUES ($1, $2, $3, $4::jsonb, 'pending', $5)
         RETURNING id`,
        [
          order.id,
          customerName.trim(),
          customerPhone.trim(),
          JSON.stringify(addressSnapshot),
          deliveryFee
        ]
      );

      await client.query(
        `INSERT INTO delivery.delivery_status_history (
           delivery_order_id,
           old_status,
           new_status,
           changed_by,
           note
         )
         VALUES ($1, NULL, 'pending', $2, $3)`,
        [
          deliveryResult.rows[0].id,
          userId,
          "Khách hàng tạo đơn giao hàng"
        ]
      );
    }
    await client.query(
      `INSERT INTO orders.payments (
         order_id,
         payment_method,
         payment_status,
         amount,
         currency
       )
       VALUES ($1, $2, $3, $4, 'VND')`,
      [
        order.id,
        input.paymentMethod,
        input.paymentMethod === "cash" ? "unpaid" : "pending",
        grandTotal
      ]
    );

    await client.query("COMMIT");

    return order;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMyOrders(
  userId: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `SELECT
       id,
       order_code,
       order_type,
       customer_name,
       subtotal,
       grand_total,
       status,
       created_at
     FROM orders.customer_orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
}

export async function getOrderDetail(
  userId: string,
  orderId: string
) {
  const orderResult = await pool.query(
    `SELECT *
     FROM orders.customer_orders
     WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
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
               'group', oio.option_group_snapshot,
               'name', oio.option_name_snapshot,
               'priceAdjustment', oio.price_adjustment,
               'quantity', oio.quantity
             )
           )
           FROM orders.order_item_options oio
           WHERE oio.order_item_id = oi.id
         ),
         '[]'::jsonb
       ) AS options
     FROM orders.order_items oi
     WHERE oi.order_id = $1
     ORDER BY oi.created_at`,
    [orderId]
  );

    const historyResult = await pool.query(
    `SELECT old_status, new_status, note, created_at
     FROM orders.order_status_history
     WHERE order_id = $1
     ORDER BY created_at`,
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
    payments: paymentResult.rows
  };
}

export async function cancelOrder(
  userId: string,
  orderId: string,
  reason?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, status
       FROM orders.customer_orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [orderId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const order = result.rows[0];

    if (order.status !== "pending") {
      throw new Error("ORDER_CANNOT_BE_CANCELLED");
    }

    const cancellationReason =
      reason?.trim() || "Khách hàng yêu cầu hủy";

    await client.query(
      `UPDATE orders.customer_orders
       SET status = 'cancelled',
           cancellation_reason = $3,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [orderId, userId, cancellationReason]
    );

    await client.query(
      `INSERT INTO orders.order_status_history (
         order_id, old_status, new_status, changed_by, note
       )
       VALUES ($1, 'pending', 'cancelled', $2, $3)`,
      [orderId, userId, cancellationReason]
    );

    // Đồng bộ trạng thái giao hàng nếu đơn có Delivery.
    const deliveryResult = await client.query(
      `SELECT id, status
       FROM delivery.delivery_orders
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (deliveryResult.rows.length > 0) {
      const delivery = deliveryResult.rows[0];

      if (["pending", "assigned"].includes(delivery.status)) {
        await client.query(
          `UPDATE delivery.delivery_orders
           SET status = 'cancelled',
               cancellation_reason = $2,
               cancelled_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [delivery.id, cancellationReason]
        );

        await client.query(
          `INSERT INTO delivery.delivery_status_history (
             delivery_order_id,
             old_status,
             new_status,
             changed_by,
             note
           )
           VALUES ($1, $2, 'cancelled', $3, $4)`,
          [
            delivery.id,
            delivery.status,
            userId,
            cancellationReason
          ]
        );
      }
    }

    await client.query("COMMIT");

    return { id: orderId, status: "cancelled" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}