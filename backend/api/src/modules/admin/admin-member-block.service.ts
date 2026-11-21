
import pool from "../../database/postgres";

export async function blockAdminMember(userId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE auth.users
      SET
        status = 'blocked',
        locked_until = NULL,
        failed_login_attempts = 0,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        AND status = 'active'
      RETURNING id, status, locked_until, updated_at
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      const check = await client.query(
        `
        SELECT id, status
        FROM auth.users
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [userId]
      );

      await client.query("COMMIT");

      if (check.rows.length === 0) {
        return { notFound: true };
      }

      if (check.rows[0].status === "blocked") {
        return { alreadyBlocked: true };
      }

      return { invalidStatus: check.rows[0].status };
    }

    // Thu hồi tất cả phiên đăng nhập chưa bị thu hồi
    const revokeResult = await client.query(
      `
      UPDATE auth.user_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId]
    );

    await client.query("COMMIT");

    return {
      success: true,
      data: result.rows[0],
      revokedSessions: revokeResult.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function unblockAdminMember(userId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE auth.users
      SET
        status = 'active',
        locked_until = NULL,
        failed_login_attempts = 0,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        AND status = 'blocked'
      RETURNING id, status, locked_until, updated_at
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      const check = await client.query(
        `
        SELECT id, status
        FROM auth.users
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [userId]
      );

      await client.query("COMMIT");

      if (check.rows.length === 0) {
        return { notFound: true };
      }

      if (check.rows[0].status === "active") {
        return { alreadyActive: true };
      }

      return { invalidStatus: check.rows[0].status };
    }

    await client.query("COMMIT");

    return {
      success: true,
      data: result.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
