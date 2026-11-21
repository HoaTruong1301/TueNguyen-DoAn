
import pool from "../../database/postgres";
import type { UpdateAdminMemberProfileInput } from "./admin-member-profile.schema";

export async function updateAdminMemberProfile(
  userId: string,
  input: UpdateAdminMemberProfileInput
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Kiểm tra tài khoản khách hàng
    const userResult = await client.query(
      `
      SELECT id
      FROM auth.users
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    // Tạo hồ sơ nếu khách hàng chưa có profile
    await client.query(
      `
      INSERT INTO member.user_profiles (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    // Chỉ cập nhật những trường được gửi lên
    const fields: string[] = [];
    const values: unknown[] = [userId];

    const allowedFields = [
      "full_name",
      "phone_number",
      "date_of_birth",
      "gender",
      "avatar_url",
    ] as const;

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        values.push(input[field]);
        fields.push(`${field} = $${values.length}`);
      }
    }

    const result = await client.query(
      `
      UPDATE member.user_profiles
      SET
        ${fields.join(", ")},
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING
        id,
        user_id,
        full_name,
        phone_number,
        date_of_birth,
        gender,
        avatar_url,
        created_at,
        updated_at
      `,
      values
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
