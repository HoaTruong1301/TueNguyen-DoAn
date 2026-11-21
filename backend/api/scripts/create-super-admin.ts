
import "dotenv/config";
import { randomUUID } from "crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pool from "../src/database/postgres";
import { hashPassword } from "../src/utils/password";

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const email = (await rl.question("Email quan tri: "))
      .trim()
      .toLowerCase();

    const password = await rl.question("Mat khau quan tri (khong hien khi nhap): ");

    if (!email || !email.includes("@")) {
      throw new Error("Email khong hop le");
    }

    if (password.length < 12) {
      throw new Error("Mat khau phai co it nhat 12 ky tu");
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id FROM auth.users
         WHERE lower(email) = lower($1) AND deleted_at IS NULL
         LIMIT 1`,
        [email]
      );

      if (existing.rowCount) {
        throw new Error("Email da ton tai; dung email khac");
      }

      const adminCount = await client.query(
        `SELECT COUNT(*)::int AS total FROM admin.admin_users`
      );

      if (adminCount.rows[0].total > 0) {
        throw new Error(
          "Da co tai khoan quan tri. Dung quy trinh cap quyen thay vi khoi tao lan dau."
        );
      }

      const role = await client.query(
        `SELECT id FROM admin.roles WHERE code = 'SUPER_ADMIN' LIMIT 1`
      );

      if (!role.rowCount) {
        throw new Error("Khong tim thay vai tro SUPER_ADMIN");
      }

      const userId = randomUUID();

      await client.query(
        `INSERT INTO auth.users
          (id, email, password_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW())`,
        [userId, email, passwordHash]
      );

      const admin = await client.query(
        `INSERT INTO admin.admin_users (user_id, status)
         VALUES ($1, 'active')
         RETURNING id`,
        [userId]
      );

      await client.query(
        `INSERT INTO admin.admin_user_roles (admin_user_id, role_id)
         VALUES ($1, $2)`,
        [admin.rows[0].id, role.rows[0].id]
      );

      await client.query("COMMIT");
      console.log("Da tao tai khoan SUPER_ADMIN thanh cong.");
      console.log(`Email: ${email}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Khong the tao SUPER_ADMIN:", error.message);
  process.exitCode = 1;
});
