import fs from "node:fs";
import path from "node:path";
import pool from "../src/database/postgres";

async function main() {
  const migrationPath = path.resolve(
    process.cwd(),
    "../../database/migrations/028_notification_device_tokens.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("Migration 028 completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration 028 failed:", error);
  process.exitCode = 1;
});
