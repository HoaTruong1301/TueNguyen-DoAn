
import pool from "../../database/postgres";

export interface AdminBannerInput {
  title: string;
  subtitle?: string | null;
  image_url: string;
  mobile_image_url?: string | null;
  action_type?: string;
  action_value?: string | null;
  sort_order?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export async function getAdminBanners() {
  const result = await pool.query(
    `
    SELECT
      id,
      title,
      subtitle,
      image_url,
      mobile_image_url,
      action_type,
      action_value,
      sort_order,
      starts_at,
      ends_at,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM cms.banners
    ORDER BY sort_order ASC, created_at DESC
    `
  );

  return result.rows;
}

export async function createAdminBanner(
  data: AdminBannerInput,
  adminId?: string
) {
  const result = await pool.query(
    `
    INSERT INTO cms.banners (
      title,
      subtitle,
      image_url,
      mobile_image_url,
      action_type,
      action_value,
      sort_order,
      starts_at,
      ends_at,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11, $11
    )
    RETURNING *
    `,
    [
      data.title,
      data.subtitle ?? null,
      data.image_url,
      data.mobile_image_url ?? null,
      data.action_type ?? "none",
      data.action_value ?? null,
      data.sort_order ?? 0,
      data.starts_at ?? null,
      data.ends_at ?? null,
      data.is_active ?? true,
      adminId ?? null,
    ]
  );

  return result.rows[0];
}

export async function updateAdminBanner(
  id: string,
  data: AdminBannerInput,
  adminId?: string
) {
  const result = await pool.query(
    `
    UPDATE cms.banners
    SET
      title = $2,
      subtitle = $3,
      image_url = $4,
      mobile_image_url = $5,
      action_type = $6,
      action_value = $7,
      sort_order = $8,
      starts_at = $9,
      ends_at = $10,
      is_active = $11,
      updated_by = $12,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      data.title,
      data.subtitle ?? null,
      data.image_url,
      data.mobile_image_url ?? null,
      data.action_type ?? "none",
      data.action_value ?? null,
      data.sort_order ?? 0,
      data.starts_at ?? null,
      data.ends_at ?? null,
      data.is_active ?? true,
      adminId ?? null,
    ]
  );

  return result.rows[0] ?? null;
}

export async function updateAdminBannerStatus(
  id: string,
  isActive: boolean,
  adminId?: string
) {
  const result = await pool.query(
    `
    UPDATE cms.banners
    SET
      is_active = $2,
      updated_by = $3,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, isActive, adminId ?? null]
  );

  return result.rows[0] ?? null;
}

export async function deleteAdminBanner(id: string) {
  const result = await pool.query(
    `
    DELETE FROM cms.banners
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );

  return result.rows[0] ?? null;
}
