require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE address_snapshot->>'latitude' IS NOT NULL
            AND address_snapshot->>'latitude' <> ''
        ) AS valid_latitude,
        COUNT(*) FILTER (
          WHERE address_snapshot->>'longitude' IS NOT NULL
            AND address_snapshot->>'longitude' <> ''
        ) AS valid_longitude,
        COUNT(*) FILTER (
          WHERE jsonb_typeof(address_snapshot->'latitude') = 'null'
        ) AS null_latitude,
        COUNT(*) FILTER (
          WHERE jsonb_typeof(address_snapshot->'longitude') = 'null'
        ) AS null_longitude
      FROM delivery.delivery_orders
    `);

    console.table(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);