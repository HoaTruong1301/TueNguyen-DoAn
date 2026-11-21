
import pool from "../../database/postgres";

export async function getCategories() {
  const result = await pool.query(
    `SELECT
       id,
       name,
       slug,
       description,
       image_url,
       sort_order
     FROM menu.food_categories
     WHERE is_active = TRUE
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, name ASC`
  );

  return result.rows;
}

export async function getFoods(
  page: number,
  limit: number,
  categoryId?: string,
  search?: string
) {
  const offset = (page - 1) * limit;
  const values: unknown[] = [];
  const conditions = [
    "f.deleted_at IS NULL",
    "f.status = 'available'",
    "c.is_active = TRUE",
    "c.deleted_at IS NULL",
  ];

  if (categoryId) {
    values.push(categoryId);
    conditions.push(`f.category_id = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(f.name ILIKE $${values.length} OR f.description ILIKE $${values.length})`
    );
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM menu.foods f
     JOIN menu.food_categories c ON c.id = f.category_id
     WHERE ${whereClause}`,
    values
  );

  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `SELECT
       f.id,
       f.category_id,
       c.name AS category_name,
       f.name,
       f.slug,
       f.description,
       f.price,
       f.sale_price,
       f.image_url,
       f.status,
       f.is_featured,
       f.preparation_time_minutes,
       f.calories
     FROM menu.foods f
     JOIN menu.food_categories c ON c.id = f.category_id
     WHERE ${whereClause}
     ORDER BY f.sort_order ASC, f.name ASC
     LIMIT $${values.length - 1}
     OFFSET $${values.length}`,
    values
  );

  return {
    items: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total as number,
      totalPages: Math.ceil(
        (countResult.rows[0].total as number) / limit
      ),
    },
  };
}

export async function getFoodById(id: string) {
  const foodResult = await pool.query(
    `SELECT
       f.id,
       f.category_id,
       c.name AS category_name,
       f.name,
       f.slug,
       f.description,
       f.price,
       f.sale_price,
       f.image_url,
       f.status,
       f.is_featured,
       f.preparation_time_minutes,
       f.calories,
       f.created_at,
       f.updated_at
     FROM menu.foods f
     JOIN menu.food_categories c ON c.id = f.category_id
     WHERE f.id = $1
       AND f.deleted_at IS NULL
       AND f.status = 'available'
       AND c.is_active = TRUE
       AND c.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );

  if (foodResult.rows.length === 0) {
    throw new Error("FOOD_NOT_FOUND");
  }

  const food = foodResult.rows[0];

  const [imagesResult, optionsResult, optionGroupsResult] =
  await Promise.all([
    pool.query(
      `SELECT id, image_url, alt_text, sort_order, is_primary
       FROM menu.food_images
       WHERE food_id = $1
       ORDER BY is_primary DESC, sort_order ASC`,
      [id]
    ),

    pool.query(
      `SELECT
         id,
         food_id,
         group_id,
         option_group,
         name,
         price_adjustment,
         is_default,
         is_available,
         sort_order
       FROM menu.food_options
       WHERE food_id = $1
         AND is_available = TRUE
       ORDER BY option_group ASC, sort_order ASC`,
      [id]
    ),

    pool.query(
      `SELECT
         id,
         food_id,
         name,
         selection_type,
         is_required,
         min_select,
         max_select,
         sort_order
       FROM menu.food_option_groups
       WHERE food_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [id]
    ),
  ]);

  return {
    ...food,
    images: imagesResult.rows,
    options: optionsResult.rows,
    optionGroups: optionGroupsResult.rows.map((group) => ({
      ...group,
      options: optionsResult.rows.filter(
        (option) => option.group_id === group.id
      ),
    })),
  };
}

export async function getFeaturedFoods(limit: number) {
  const result = await pool.query(
    `SELECT
       f.id,
       f.category_id,
       c.name AS category_name,
       f.name,
       f.slug,
       f.description,
       f.price,
       f.sale_price,
       f.image_url,
       f.is_featured,
       f.preparation_time_minutes
     FROM menu.foods f
     JOIN menu.food_categories c ON c.id = f.category_id
     WHERE f.is_featured = TRUE
       AND f.deleted_at IS NULL
       AND f.status = 'available'
       AND c.is_active = TRUE
       AND c.deleted_at IS NULL
     ORDER BY f.sort_order ASC, f.name ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

export async function getBanners() {
  const result = await pool.query(
    `SELECT
       id,
       title,
       subtitle,
       image_url,
       mobile_image_url,
       action_type,
       action_value,
       sort_order
     FROM cms.banners
     WHERE is_active = TRUE
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY sort_order ASC, created_at DESC`
  );

  return result.rows;
}
