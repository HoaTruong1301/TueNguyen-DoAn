
import pool from "../../database/postgres";

export interface CreateFoodReviewInput {
  orderId: string;
  foodId: string;
  rating: number;
  title?: string;
  content?: string;
  imageUrls?: string[];
}

export async function createFoodReview(
  userId: string,
  input: CreateFoodReviewInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa theo khách hàng, đơn hàng và món ăn để tránh
    // hai yêu cầu đồng thời tạo đánh giá trùng.
    const lockKey = `${userId}:${input.orderId}:${input.foodId}`;

    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [lockKey]
    );

    // Kiểm tra đơn hàng thuộc khách hàng.
    const orderResult = await client.query(
      `SELECT id, status
       FROM orders.customer_orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [input.orderId, userId]
    );

    if (orderResult.rowCount === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const order = orderResult.rows[0];

    if (!["completed", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_COMPLETED");
    }

    // Kiểm tra món ăn thực sự thuộc đơn hàng.
    const itemResult = await client.query(
      `SELECT id
       FROM orders.order_items
       WHERE order_id = $1
         AND food_id = $2
       LIMIT 1`,
      [input.orderId, input.foodId]
    );

    if (itemResult.rowCount === 0) {
      throw new Error("FOOD_NOT_IN_ORDER");
    }

    // Không cho đánh giá trùng món trong cùng đơn hàng.
    const existingResult = await client.query(
      `SELECT id
       FROM review.reviews
       WHERE user_id = $1
         AND order_id = $2
         AND food_id = $3
         AND review_type = 'food'
         AND status <> 'deleted'
       LIMIT 1`,
      [userId, input.orderId, input.foodId]
    );

    if ((existingResult.rowCount ?? 0) > 0) {
      throw new Error("REVIEW_ALREADY_EXISTS");
    }

    // Tạo đánh giá.
    const reviewResult = await client.query(
      `INSERT INTO review.reviews (
         user_id,
         order_id,
         food_id,
         review_type,
         rating,
         title,
         content,
         status,
         is_verified_purchase
       )
       VALUES ($1, $2, $3, 'food', $4, $5, $6, 'pending', TRUE)
       RETURNING *`,
      [
        userId,
        input.orderId,
        input.foodId,
        input.rating,
        input.title?.trim() || null,
        input.content?.trim() || null,
      ]
    );

    const review = reviewResult.rows[0];

    // Lưu hình ảnh đánh giá.
    const imageUrls = input.imageUrls ?? [];

    for (let i = 0; i < imageUrls.length; i++) {
      await client.query(
        `INSERT INTO review.review_images (
           review_id,
           image_url,
           sort_order
         )
         VALUES ($1, $2, $3)`,
        [review.id, imageUrls[i], i]
      );
    }

    await client.query("COMMIT");

    return {
      ...review,
      images: imageUrls,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function getFoodReviews(
  foodId: string,
  page: number,
  limit: number,
  rating?: number,
  hasImages: boolean = false
) {
  const offset = (page - 1) * limit;

  const [reviewsResult, countResult, ratingResult] =
    await Promise.all([
            pool.query(
        `SELECT
           r.id,
           r.user_id,
           u.full_name AS customer_name,
           r.rating,
           r.title,
           r.content,
           rr.content AS reply_content,
           rr.status AS reply_status,
           rr.updated_at AS reply_updated_at,
           r.is_verified_purchase,
           r.created_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', ri.id,
                 'imageUrl', ri.image_url
               )
               ORDER BY ri.sort_order
             ) FILTER (WHERE ri.id IS NOT NULL),
             '[]'
           ) AS images
         FROM review.reviews r
         LEFT JOIN member.user_profiles u
           ON u.user_id = r.user_id
         LEFT JOIN review.review_images ri
           ON ri.review_id = r.id
         LEFT JOIN review.review_replies rr
           ON rr.review_id = r.id
           AND rr.status = 'published'
         WHERE r.food_id = $1
           AND r.review_type = 'food'
           AND r.status = 'approved'
           AND ($2::int IS NULL OR r.rating = $2)
           AND (
             $3::boolean = false
             OR EXISTS (
               SELECT 1
               FROM review.review_images filter_images
               WHERE filter_images.review_id = r.id
             )
           )
         GROUP BY r.id, u.full_name, rr.id
         ORDER BY r.is_featured DESC, r.created_at DESC
         LIMIT $4 OFFSET $5`,
        [foodId, rating ?? null, hasImages, limit, offset]
      ),

      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM review.reviews r
         WHERE r.food_id = $1
           AND r.review_type = 'food'
           AND r.status = 'approved'
           AND ($2::int IS NULL OR r.rating = $2)
           AND (
             $3::boolean = false
             OR EXISTS (
               SELECT 1
               FROM review.review_images ri
               WHERE ri.review_id = r.id
             )
           )`,
        [foodId, rating ?? null, hasImages]
      ),

      pool.query(
        `SELECT
          COALESCE(AVG(r.rating), 0)::numeric(3,2) AS average_rating,
          COUNT(*)::int AS total_reviews,

          COUNT(*) FILTER (WHERE r.rating = 5)::int AS rating_5,
          COUNT(*) FILTER (WHERE r.rating = 4)::int AS rating_4,
          COUNT(*) FILTER (WHERE r.rating = 3)::int AS rating_3,
          COUNT(*) FILTER (WHERE r.rating = 2)::int AS rating_2,
          COUNT(*) FILTER (WHERE r.rating = 1)::int AS rating_1,

          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM review.review_images ri
              WHERE ri.review_id = r.id
            )
          )::int AS reviews_with_images,

          COALESCE(
            ROUND(
              100.0 * COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1
                  FROM review.review_images ri
                  WHERE ri.review_id = r.id
                )
              ) / NULLIF(COUNT(*), 0),
              2
            ),
            0
          )::numeric(5,2) AS image_percentage

        FROM review.reviews r
        WHERE r.food_id = $1
          AND r.review_type = 'food'
          AND r.status = 'approved'`,
        [foodId]
      ),
    ]);

  return {
    items: reviewsResult.rows,
    summary: ratingResult.rows[0],
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

export async function getFoodReviewStatus(
  userId: string,
  orderId: string,
  foodId: string
) {
  const result = await pool.query(
    `SELECT
       id,
       rating,
       status,
       created_at
     FROM review.reviews
     WHERE user_id = $1
       AND order_id = $2
       AND food_id = $3
       AND review_type = 'food'
       AND status <> 'deleted'
     LIMIT 1`,
    [userId, orderId, foodId]
  );

  if (result.rowCount === 0) {
    return {
      hasReviewed: false,
      review: null,
    };
  }

  return {
    hasReviewed: true,
    review: result.rows[0],
  };
}



export interface CreateOrderReviewInput {
  orderRating: number;
  serviceRating: number;
  deliveryRating?: number;
  orderContent?: string;
  serviceContent?: string;
  deliveryContent?: string;
}

export async function createOrderReview(
  userId: string,
  orderId: string,
  input: CreateOrderReviewInput
) {
  const ratings = [
    input.orderRating,
    input.serviceRating,
    ...(input.deliveryRating !== undefined
      ? [input.deliveryRating]
      : []),
  ];

  if (ratings.some((rating) =>
    !Number.isInteger(rating) || rating < 1 || rating > 5
  )) {
    throw new Error("INVALID_RATING");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa đơn hàng để tránh gửi đánh giá trùng đồng thời.
    const orderResult = await client.query(
      `SELECT id, user_id, status, order_type
       FROM orders.customer_orders
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [orderId, userId]
    );

    if (orderResult.rowCount === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const order = orderResult.rows[0];

    if (!["completed", "delivered"].includes(order.status)) {
      throw new Error("ORDER_NOT_COMPLETED");
    }

    const reviewItems: Array<{
      type: string;
      rating: number;
      content?: string;
    }> = [
      {
        type: "order",
        rating: input.orderRating,
        content: input.orderContent,
      },
      {
        type: "service",
        rating: input.serviceRating,
        content: input.serviceContent,
      },
    ];

    if (order.order_type === "delivery") {
      if (input.deliveryRating === undefined) {
        throw new Error("DELIVERY_RATING_REQUIRED");
      }

      reviewItems.push({
        type: "delivery",
        rating: input.deliveryRating,
        content: input.deliveryContent,
      });
    } else if (input.deliveryRating !== undefined) {
      throw new Error("DELIVERY_REVIEW_NOT_ALLOWED");
    }

    const createdReviews = [];

    for (const item of reviewItems) {
      const existingResult = await client.query(
        `SELECT id
         FROM review.reviews
         WHERE user_id = $1
           AND order_id = $2
           AND review_type = $3
           AND status <> 'deleted'
         LIMIT 1`,
        [userId, orderId, item.type]
      );

      if ((existingResult.rowCount ?? 0) > 0) {
        throw new Error("REVIEW_ALREADY_EXISTS");
      }

      const reviewResult = await client.query(
        `INSERT INTO review.reviews (
           user_id,
           order_id,
           review_type,
           rating,
           content,
           status,
           is_verified_purchase
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', TRUE)
         RETURNING *`,
        [
          userId,
          orderId,
          item.type,
          item.rating,
          item.content?.trim() || null,
        ]
      );

      createdReviews.push(reviewResult.rows[0]);
    }

    await client.query("COMMIT");

    return createdReviews;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


export async function getOrderReviewStatus(
  userId: string,
  orderId: string
) {
  const orderResult = await pool.query(
    `SELECT id, order_type
     FROM orders.customer_orders
     WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );

  if (orderResult.rowCount === 0) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const order = orderResult.rows[0];

  const reviewTypes = [
    "order",
    "service",
    ...(order.order_type === "delivery" ? ["delivery"] : []),
  ];

  const result = await pool.query(
    `SELECT
       review_type,
       id,
       rating,
       status,
       created_at
     FROM review.reviews
     WHERE user_id = $1
       AND order_id = $2
       AND review_type = ANY($3::varchar[])
       AND status <> 'deleted'`,
    [userId, orderId, reviewTypes]
  );

  const reviews: Record<string, any> = {};

  for (const type of reviewTypes) {
    const review = result.rows.find(
      (item) => item.review_type === type
    );

    reviews[type] = {
      hasReviewed: Boolean(review),
      review: review ?? null,
    };
  }

  return {
    orderType: order.order_type,
    reviews,
  };
}


export interface AdminReviewFilters {
  page: number;
  limit: number;
  status?: string;
  reviewType?: string;
  rating?: number;
  search?: string;
}

export async function getAdminReviews(
  filters: AdminReviewFilters
) {
  const {
    page,
    limit,
    status,
    reviewType,
    rating,
    search,
  } = filters;

  const offset = (page - 1) * limit;
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (status) {
    values.push(status);
    conditions.push(`r.status = $${values.length}`);
  }

  if (reviewType) {
    values.push(reviewType);
    conditions.push(`r.review_type = $${values.length}`);
  }

  if (rating !== undefined) {
    values.push(rating);
    conditions.push(`r.rating = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;

    conditions.push(
      `(u.full_name ILIKE $${index}
        OR r.title ILIKE $${index}
        OR r.content ILIKE $${index})`
    );
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM review.reviews r
     LEFT JOIN member.user_profiles u
       ON u.user_id = r.user_id
     ${whereClause}`,
    values
  );

  const total = countResult.rows[0].total;

  const dataValues = [...values, limit, offset];

  const reviewsResult = await pool.query(
    `SELECT
       r.id,
       r.user_id,
       u.full_name AS customer_name,
       r.order_id,
       r.food_id,
       r.reservation_id,
       r.review_type,
       r.rating,
       r.title,
       r.content,
       r.status,
       r.is_verified_purchase,
       r.is_featured,
       r.admin_note,
       r.moderated_by,
       r.moderated_at,
       r.created_at,
       r.updated_at,
       rr.id AS reply_id,
       rr.content AS reply_content,
       rr.status AS reply_status,
       rr.updated_at AS reply_updated_at,
       COALESCE(
         json_agg(
           json_build_object(
             'id', ri.id,
             'imageUrl', ri.image_url,
             'sortOrder', ri.sort_order
           )
           ORDER BY ri.sort_order
         ) FILTER (WHERE ri.id IS NOT NULL),
         '[]'
       ) AS images
     FROM review.reviews r
     LEFT JOIN member.user_profiles u
       ON u.user_id = r.user_id
          LEFT JOIN review.review_images ri
       ON ri.review_id = r.id
     LEFT JOIN review.review_replies rr
       ON rr.review_id = r.id
       AND rr.status = 'published'
     ${whereClause}
     GROUP BY r.id, u.full_name, rr.id
     ORDER BY
       CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
       r.created_at DESC
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2}`,
    dataValues
  );

    const summaryResult = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::int AS pending,
      COUNT(*) FILTER (
        WHERE status = 'approved'
      )::int AS approved,
      COUNT(*) FILTER (
        WHERE status = 'rejected'
      )::int AS rejected,
      COUNT(*) FILTER (
        WHERE status = 'hidden'
      )::int AS hidden,
      COALESCE(
        ROUND(
          AVG(rating) FILTER (
            WHERE status = 'approved'
          ),
          2
        ),
        0
      ) AS average_rating
    FROM review.reviews
  `);

  return {
    items: reviewsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: summaryResult.rows[0],
  };
}


export async function moderateReview(
  reviewId: string,
  adminId: string,
  status: "approved" | "rejected" | "hidden",
  adminNote?: string
) {
  const result = await pool.query(
    `UPDATE review.reviews
     SET
       status = $1,
       admin_note = $2,
       moderated_by = $3,
       moderated_at = NOW(),
       updated_at = NOW()
     WHERE id = $4
       AND status <> 'deleted'
     RETURNING
       id,
       status,
       admin_note,
       moderated_by,
       moderated_at,
       updated_at`,
    [status, adminNote ?? null, adminId, reviewId]
  );

  if (result.rowCount === 0) {
    throw new Error("REVIEW_NOT_FOUND");
  }

  return result.rows[0];
}


export async function replyToReview(
  reviewId: string,
  adminId: string,
  content: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Chỉ phản hồi đánh giá đã được duyệt
    const reviewResult = await client.query(
      `SELECT id, status
       FROM review.reviews
       WHERE id = $1
         AND status = 'approved'
       FOR UPDATE`,
      [reviewId]
    );

    if (reviewResult.rowCount === 0) {
      throw new Error("REVIEW_NOT_FOUND_OR_NOT_APPROVED");
    }

    // Có phản hồi thì cập nhật, chưa có thì tạo mới
    const result = await client.query(
      `INSERT INTO review.review_replies (
         review_id,
         admin_user_id,
         content,
         status
       )
       VALUES ($1, $2, $3, 'published')
       ON CONFLICT (review_id)
       DO UPDATE SET
         admin_user_id = EXCLUDED.admin_user_id,
         content = EXCLUDED.content,
         status = 'published',
         updated_at = NOW()
       RETURNING
         id,
         review_id,
         admin_user_id,
         content,
         status,
         created_at,
         updated_at`,
      [reviewId, adminId, content]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


