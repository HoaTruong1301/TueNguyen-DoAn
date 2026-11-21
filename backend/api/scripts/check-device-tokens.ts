import pool from "../src/database/postgres";

async function main() {
  try {
    const result = await pool.query(
      `SELECT
         id,
         user_id,
         platform,
         LEFT(fcm_token, 12) || '...' AS token_preview,
         created_at,
         updated_at
       FROM notification.device_tokens
       ORDER BY updated_at DESC
       LIMIT 10`
    );

    console.table(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
