
import pool from "../../database/postgres";

export async function getActiveVouchers(
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM promotion.vouchers
     WHERE is_active = TRUE
       AND starts_at <= NOW()
       AND ends_at > NOW()
       AND (
         usage_limit IS NULL
         OR used_count < usage_limit
       )`
  );

  const result = await pool.query(
    `SELECT
       id,
       code,
       name,
       description,
       discount_type,
       discount_value,
       max_discount_amount,
       min_order_amount,
       usage_limit,
       used_count,
       starts_at,
       ends_at
     FROM promotion.vouchers
     WHERE is_active = TRUE
       AND starts_at <= NOW()
       AND ends_at > NOW()
       AND (
         usage_limit IS NULL
         OR used_count < usage_limit
       )
     ORDER BY ends_at ASC, created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const total = countResult.rows[0].total as number;

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

export async function getVoucherById(id: string) {
  const result = await pool.query(
    `SELECT
       id,
       code,
       name,
       description,
       discount_type,
       discount_value,
       max_discount_amount,
       min_order_amount,
       usage_limit,
       used_count,
       per_user_limit,
       starts_at,
       ends_at
     FROM promotion.vouchers
     WHERE id = $1
       AND is_active = TRUE
       AND starts_at <= NOW()
       AND ends_at > NOW()
       AND (
         usage_limit IS NULL
         OR used_count < usage_limit
       )
     LIMIT 1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  const voucher = result.rows[0];

  const [categoriesResult, foodsResult] = await Promise.all([
    pool.query(
      `SELECT category_id
       FROM promotion.voucher_categories
       WHERE voucher_id = $1`,
      [id]
    ),
    pool.query(
      `SELECT food_id
       FROM promotion.voucher_foods
       WHERE voucher_id = $1`,
      [id]
    ),
  ]);

  return {
    ...voucher,
    categories: categoriesResult.rows,
    foods: foodsResult.rows,
  };
}


export async function validateVoucher(
  userId: string,
  voucherCode: string,
  items: {
    foodId: string;
    quantity: number;
  }[]
) {
  const code = voucherCode.trim().toUpperCase();

  if (!code || items.length === 0) {
    throw new Error("VOUCHER_NOT_APPLICABLE");
  }

  const voucherResult = await pool.query(
    `SELECT *
     FROM promotion.vouchers
     WHERE UPPER(code) = $1
     LIMIT 1`,
    [code]
  );

  if (voucherResult.rows.length === 0) {
    throw new Error("VOUCHER_NOT_FOUND");
  }

  const voucher = voucherResult.rows[0];

  if (!voucher.is_active) {
    throw new Error("VOUCHER_INACTIVE");
  }

  const now = new Date();

  if (new Date(voucher.starts_at) > now) {
    throw new Error("VOUCHER_NOT_STARTED");
  }

  if (new Date(voucher.ends_at) <= now) {
    throw new Error("VOUCHER_EXPIRED");
  }

  if (
    voucher.usage_limit !== null &&
    Number(voucher.used_count) >= Number(voucher.usage_limit)
  ) {
    throw new Error("VOUCHER_USAGE_LIMIT_REACHED");
  }

  const foodIds = [...new Set(items.map((item) => item.foodId))];

  const foodsResult = await pool.query(
    `SELECT id, category_id, price, sale_price, status
     FROM menu.foods
     WHERE id = ANY($1::uuid[])
       AND deleted_at IS NULL`,
    [foodIds]
  );

  const foods = new Map(
    foodsResult.rows.map((food) => [food.id, food])
  );

  let subtotal = 0;

  const preparedItems = items.map((item) => {
    const food = foods.get(item.foodId);

    if (
      !food ||
      food.status !== "available" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw new Error("VOUCHER_NOT_APPLICABLE");
    }

    const unitPrice =
      food.sale_price !== null &&
      Number(food.sale_price) > 0
        ? Number(food.sale_price)
        : Number(food.price);

    const lineTotal = unitPrice * item.quantity;

    subtotal += lineTotal;

    return {
      foodId: item.foodId,
      categoryId: food.category_id,
      lineTotal,
    };
  });

  if (subtotal < Number(voucher.min_order_amount)) {
    throw new Error("VOUCHER_MIN_ORDER_NOT_MET");
  }

  if (voucher.per_user_limit !== null) {
    const usageResult = await pool.query(
      `SELECT usage_count
       FROM promotion.voucher_user_limits
       WHERE voucher_id = $1
         AND user_id = $2
       LIMIT 1`,
      [voucher.id, userId]
    );

    const usageCount =
      usageResult.rows.length > 0
        ? Number(usageResult.rows[0].usage_count)
        : 0;

    if (usageCount >= Number(voucher.per_user_limit)) {
      throw new Error("VOUCHER_USER_LIMIT_REACHED");
    }
  }

  const [voucherFoodsResult, voucherCategoriesResult] =
    await Promise.all([
      pool.query(
        `SELECT food_id
         FROM promotion.voucher_foods
         WHERE voucher_id = $1`,
        [voucher.id]
      ),
      pool.query(
        `SELECT category_id
         FROM promotion.voucher_categories
         WHERE voucher_id = $1`,
        [voucher.id]
      ),
    ]);

  const allowedFoodIds = new Set(
    voucherFoodsResult.rows.map((row) => row.food_id)
  );

  const allowedCategoryIds = new Set(
    voucherCategoriesResult.rows.map((row) => row.category_id)
  );

  const hasRestrictions =
    allowedFoodIds.size > 0 || allowedCategoryIds.size > 0;

  const eligibleSubtotal = preparedItems.reduce(
    (total, item) => {
      if (
        !hasRestrictions ||
        allowedFoodIds.has(item.foodId) ||
        allowedCategoryIds.has(item.categoryId)
      ) {
        return total + item.lineTotal;
      }

      return total;
    },
    0
  );

  if (eligibleSubtotal <= 0) {
    throw new Error("VOUCHER_NOT_APPLICABLE");
  }

  let discountTotal = 0;

  if (voucher.discount_type === "percentage") {
    discountTotal =
      eligibleSubtotal * Number(voucher.discount_value) / 100;

    if (voucher.max_discount_amount !== null) {
      discountTotal = Math.min(
        discountTotal,
        Number(voucher.max_discount_amount)
      );
    }
  } else if (voucher.discount_type === "fixed_amount") {
    discountTotal = Number(voucher.discount_value);
  } else {
    throw new Error("VOUCHER_INVALID_DISCOUNT_TYPE");
  }

  discountTotal = Math.round(
    Math.min(discountTotal, eligibleSubtotal) * 100
  ) / 100;

  if (discountTotal <= 0) {
    throw new Error("VOUCHER_NO_DISCOUNT");
  }

  return {
    voucherId: voucher.id,
    voucherCode: voucher.code,
    voucherName: voucher.name,
    discountType: voucher.discount_type,
    discountValue: Number(voucher.discount_value),
    subtotal: Math.round(subtotal * 100) / 100,
    eligibleSubtotal: Math.round(eligibleSubtotal * 100) / 100,
    discountTotal,
    grandTotal: Math.round((subtotal - discountTotal) * 100) / 100,
  };
}


export async function getMyVoucherHistory(
  userId: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const [historyResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         vh.id,
         vh.voucher_id,
         v.code AS voucher_code,
         v.name AS voucher_name,
         v.discount_type,
         v.discount_value,
         vh.order_id,
         o.order_code,
         vh.discount_amount,
         vh.used_at
       FROM promotion.voucher_usage_history vh
       INNER JOIN promotion.vouchers v
         ON v.id = vh.voucher_id
       LEFT JOIN orders.customer_orders o
         ON o.id = vh.order_id
       WHERE vh.user_id = $1
       ORDER BY vh.used_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),

    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM promotion.voucher_usage_history
       WHERE user_id = $1`,
      [userId]
    )
  ]);

  const total = countResult.rows[0].total;

  return {
    items: historyResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
