import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,

  max: 20,

  idleTimeoutMillis: 30_000,

  connectionTimeoutMillis: 5_000
});

pool.on("error", (error: Error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

export async function testDatabaseConnection(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connected successfully.");
  } finally {
    client.release();
  }
}

export default pool;