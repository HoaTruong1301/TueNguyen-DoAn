import pool from "../../database/postgres";

function makeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getAdminFoods(search?: string) {
  const result = await pool.query(
    `SELECT f.id, f.category_id, c.name AS category_name,
            f.name, f.slug, f.description, f.price, f.sale_price,
            f.image_url, f.status, f.is_featured, f.sort_order,
            f.created_at, f.updated_at
     FROM menu.foods f
     LEFT JOIN menu.food_categories c ON c.id = f.category_id
     WHERE f.deleted_at IS NULL
       AND ($1::text IS NULL OR f.name ILIKE '%' || $1 || '%')
     ORDER BY f.sort_order, f.created_at DESC`,
    [search?.trim() || null]
  );

  return result.rows;
}

export async function getAdminFoodCategories() {
  const result = await pool.query(
    `SELECT id, name, slug
     FROM menu.food_categories
     WHERE is_active = TRUE AND deleted_at IS NULL
     ORDER BY sort_order, name`
  );

  return result.rows;
}

export async function createAdminFood(data: {
  category_id: string;
  name: string;
  price: number;
  description?: string;
  sale_price?: number | null;
  image_url?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const slug = makeSlug(data.name);

    const result = await client.query(
      `INSERT INTO menu.foods
       (category_id, name, slug, price, sale_price, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.category_id,
        data.name.trim(),
        slug,
        data.price,
        data.sale_price ?? null,
        data.description ?? null,
        data.image_url ?? null,
      ]
    );

    const food = result.rows[0];

    if (data.image_url) {
      await client.query(
        `INSERT INTO menu.food_images
         (food_id, image_url, is_primary, sort_order)
         VALUES ($1, $2, TRUE, 0)`,
        [food.id, data.image_url]
      );
    }

    await client.query("COMMIT");
    return food;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdminFood(
  id: string,
  data: {
    category_id?: string;
    name?: string;
    price?: number;
    sale_price?: number | null;
    description?: string | null;
    image_url?: string | null;
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE menu.foods
       SET category_id = COALESCE($2::uuid, category_id),
           name = COALESCE($3::varchar, name),
           slug = COALESCE($4::varchar, slug),
           price = COALESCE($5::numeric, price),
           sale_price = CASE WHEN $6::boolean THEN $7::numeric ELSE sale_price END,
           description = CASE WHEN $8::boolean THEN $9::text ELSE description END,
           image_url = CASE WHEN $10::boolean THEN $11::text ELSE image_url END,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        data.category_id ?? null,
        data.name?.trim() || null,
        data.name ? makeSlug(data.name) : null,
        data.price ?? null,
        data.sale_price !== undefined,
        data.sale_price ?? null,
        data.description !== undefined,
        data.description ?? null,
        data.image_url !== undefined,
        data.image_url ?? null,
      ]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    if (data.image_url) {
      await client.query(
        `UPDATE menu.food_images
         SET is_primary = FALSE
         WHERE food_id = $1`,
        [id]
      );

      await client.query(
        `INSERT INTO menu.food_images
         (food_id, image_url, is_primary, sort_order)
         VALUES ($1, $2, TRUE, 0)`,
        [id, data.image_url]
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdminFoodStatus(
  id: string,
  status: "available" | "unavailable"
) {
  const result = await pool.query(
    `UPDATE menu.foods
     SET status = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, status]
  );

  return result.rows[0] ?? null;
}

export async function deleteAdminFood(id: string) {
  const result = await pool.query(
    `UPDATE menu.foods
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id]
  );

  return result.rows[0] ?? null;
}


export async function getAdminFoodOptions(foodId: string) {
  const foodResult = await pool.query(
    `SELECT id FROM menu.foods
     WHERE id = $1 AND deleted_at IS NULL`,
    [foodId]
  );

  if (foodResult.rows.length === 0) {
    return null;
  }

  const groupsResult = await pool.query(
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
    [foodId]
  );

  const optionsResult = await pool.query(
    `SELECT
       id,
       food_id,
       group_id,
       name,
       price_adjustment,
       is_default,
       is_available,
       sort_order
     FROM menu.food_options
     WHERE food_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [foodId]
  );

  return groupsResult.rows.map((group) => ({
    ...group,
    options: optionsResult.rows.filter(
      (option) => option.group_id === group.id
    ),
  }));
}

export async function saveAdminFoodOptions(
  foodId: string,
  groups: {
    name: string;
    selection_type: "single" | "multiple";
    is_required: boolean;
    min_select: number;
    max_select: number | null;
    sort_order: number;
    options: {
      name: string;
      price_adjustment: number;
      is_default: boolean;
      is_available: boolean;
      sort_order: number;
    }[];
  }[]
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const foodResult = await client.query(
      `SELECT id FROM menu.foods
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [foodId]
    );

    if (foodResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    for (const group of groups) {
      if (
        !group.name.trim() ||
        !["single", "multiple"].includes(group.selection_type) ||
        !Number.isInteger(group.min_select) ||
        group.min_select < 0 ||
        (group.max_select !== null &&
          (!Number.isInteger(group.max_select) ||
            group.max_select < group.min_select)) ||
        !Array.isArray(group.options)
      ) {
        throw new Error("INVALID_FOOD_OPTION_GROUP");
      }

      if (
        group.selection_type === "single" &&
        group.max_select !== null &&
        group.max_select > 1
      ) {
        throw new Error("INVALID_SINGLE_SELECTION_LIMIT");
      }

      if (group.options.length < group.min_select) {
        throw new Error("NOT_ENOUGH_FOOD_OPTIONS");
      }

      if (
        group.max_select !== null &&
        group.max_select > group.options.length
      ) {
        throw new Error("INVALID_MAX_SELECT");
      }

      if (
        group.options.some(
          (option) =>
            !option.name.trim() ||
            !Number.isFinite(option.price_adjustment) ||
            option.price_adjustment < 0
        )
      ) {
        throw new Error("INVALID_FOOD_OPTION");
      }

      const defaultCount = group.options.filter(
        (option) => option.is_default
      ).length;

      if (
        group.selection_type === "single" &&
        defaultCount > 1
      ) {
        throw new Error("TOO_MANY_DEFAULT_OPTIONS");
      }

      if (
        group.max_select !== null &&
        defaultCount > group.max_select
      ) {
        throw new Error("TOO_MANY_DEFAULT_OPTIONS");
      }
    }

    await client.query(
      `DELETE FROM menu.food_option_groups
       WHERE food_id = $1`,
      [foodId]
    );

    for (const group of groups) {
      const groupResult = await client.query(
        `INSERT INTO menu.food_option_groups
         (
           food_id,
           name,
           selection_type,
           is_required,
           min_select,
           max_select,
           sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          foodId,
          group.name.trim(),
          group.selection_type,
          group.is_required,
          group.min_select,
          group.max_select,
          group.sort_order,
        ]
      );

      const groupId = groupResult.rows[0].id;

      for (const option of group.options) {
        await client.query(
          `INSERT INTO menu.food_options
           (
             food_id,
             group_id,
             option_group,
             name,
             price_adjustment,
             is_default,
             is_available,
             sort_order
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            foodId,
            groupId,
            group.name.trim(),
            option.name.trim(),
            option.price_adjustment,
            option.is_default,
            option.is_available,
            option.sort_order,
          ]
        );
      }
    }

    await client.query("COMMIT");

    return await getAdminFoodOptions(foodId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

