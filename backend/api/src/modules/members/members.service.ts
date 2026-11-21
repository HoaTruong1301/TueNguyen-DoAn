import pool from "../../database/postgres";


export async function getMyProfile(userId: string) {
  const result = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.full_name,
       p.phone_number,
       p.avatar_url,
       p.date_of_birth,
       p.gender,
       p.created_at,
       p.updated_at,
       u.email,
       u.email_verified_at
     FROM member.user_profiles p
     JOIN auth.users u ON u.id = p.user_id
     WHERE p.user_id = $1
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  return result.rows[0];
}


export async function createOrUpdateMyProfile(
  userId: string,
  data: {
    fullName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    dateOfBirth?: string;
    gender?: string;
  }
) {
  const existing = await pool.query(
    `SELECT id
     FROM member.user_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (existing.rows.length === 0) {
    const result = await pool.query(
      `INSERT INTO member.user_profiles (
         user_id,
         full_name,
         phone_number,
         avatar_url,
         date_of_birth,
         gender
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         user_id,
         full_name,
         phone_number,
         avatar_url,
         date_of_birth,
         gender,
         created_at,
         updated_at`,
      [
        userId,
        data.fullName || null,
        data.phoneNumber || null,
        data.avatarUrl || null,
        data.dateOfBirth || null,
        data.gender || null,
      ]
    );

    return result.rows[0];
  }

  const result = await pool.query(
    `UPDATE member.user_profiles
     SET
       full_name = COALESCE($2, full_name),
       phone_number = COALESCE($3, phone_number),
       avatar_url = COALESCE($4, avatar_url),
       date_of_birth = COALESCE($5, date_of_birth),
       gender = COALESCE($6, gender),
       updated_at = NOW()
     WHERE user_id = $1
     RETURNING
       id,
       user_id,
       full_name,
       phone_number,
       avatar_url,
       date_of_birth,
       gender,
       created_at,
       updated_at`,
    [
      userId,
      data.fullName,
      data.phoneNumber,
      data.avatarUrl,
      data.dateOfBirth,
      data.gender,
    ]
  );

  return result.rows[0];
}

export async function getMyAddresses(userId: string) {
  const result = await pool.query(
    `SELECT
       id,
       user_id,
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
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function createAddress(
  userId: string,
  data: {
    recipientName: string;
    phone: string;
    addressLine: string;
    ward?: string;
    district?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM member.user_addresses
       WHERE user_id = $1`,
      [userId]
    );

    const addressCount = countResult.rows[0].count;

    // Địa chỉ đầu tiên tự động trở thành mặc định
    const shouldBeDefault =
      data.isDefault === true || addressCount === 0;

    if (shouldBeDefault) {
      await client.query(
        `UPDATE member.user_addresses
         SET is_default = FALSE,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    }

    const result = await client.query(
      `INSERT INTO member.user_addresses (
         user_id,
         recipient_name,
         phone,
         address_line,
         ward,
         district,
         province,
         latitude,
         longitude,
         is_default
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
       )
       RETURNING
         id,
         user_id,
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
         updated_at`,
      [
        userId,
        data.recipientName,
        data.phone,
        data.addressLine,
        data.ward || null,
        data.district || null,
        data.province || null,
        data.latitude ?? null,
        data.longitude ?? null,
        shouldBeDefault,
      ]
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

export async function updateAddress(
  userId: string,
  addressId: string,
  data: {
    recipientName?: string;
    phone?: string;
    addressLine?: string;
    ward?: string;
    district?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
  }
) {
  const result = await pool.query(
    `UPDATE member.user_addresses
     SET
       recipient_name = COALESCE($3, recipient_name),
       phone = COALESCE($4, phone),
       address_line = COALESCE($5, address_line),
       ward = COALESCE($6, ward),
       district = COALESCE($7, district),
       province = COALESCE($8, province),
       latitude = COALESCE($9, latitude),
       longitude = COALESCE($10, longitude),
       updated_at = NOW()
     WHERE id = $1
       AND user_id = $2
     RETURNING
       id,
       user_id,
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
       updated_at`,
    [
      addressId,
      userId,
      data.recipientName,
      data.phone,
      data.addressLine,
      data.ward,
      data.district,
      data.province,
      data.latitude ?? null,
      data.longitude ?? null,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error("ADDRESS_NOT_FOUND");
  }

  return result.rows[0];
}

export async function setDefaultAddress(
  userId: string,
  addressId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const address = await client.query(
      `SELECT id
       FROM member.user_addresses
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [addressId, userId]
    );

    if (address.rows.length === 0) {
      throw new Error("ADDRESS_NOT_FOUND");
    }

    await client.query(
      `UPDATE member.user_addresses
       SET is_default = FALSE,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    const result = await client.query(
      `UPDATE member.user_addresses
       SET is_default = TRUE,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING
         id,
         user_id,
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
         updated_at`,
      [addressId, userId]
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

export async function deleteAddress(
  userId: string,
  addressId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const addressResult = await client.query(
      `SELECT id, is_default
       FROM member.user_addresses
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [addressId, userId]
    );

    if (addressResult.rows.length === 0) {
      throw new Error("ADDRESS_NOT_FOUND");
    }

    const address = addressResult.rows[0];

    await client.query(
      `DELETE FROM member.user_addresses
       WHERE id = $1
         AND user_id = $2`,
      [addressId, userId]
    );

    // Nếu xóa địa chỉ mặc định,
    // tự chọn địa chỉ mới làm mặc định.
    if (address.is_default) {
      await client.query(
        `UPDATE member.user_addresses
         SET is_default = TRUE,
             updated_at = NOW()
         WHERE id = (
           SELECT id
           FROM member.user_addresses
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [userId]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}