const argon2 = require("argon2");
const { Pool } = require("pg");
require("dotenv").config();

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const name = argument("name");
  const email = argument("email");
  const tier = argument("tier") || "starter";
  const adminEmail = argument("admin-email");
  const adminPassword = argument("admin-password");
  const connectionString = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;

  if (!name || !email || !adminEmail || !adminPassword || !connectionString) {
    throw new Error("Required: --name --email --admin-email --admin-password and database URL");
  }
  if (!process.env.ADMIN_DATABASE_URL && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_DATABASE_URL is required in production");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const merchant = await client.query(
      `INSERT INTO merchants (name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'trial') RETURNING id, name, email`,
      [name, email, tier],
    );
    const passwordHash = await argon2.hash(adminPassword);
    const staff = await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4) RETURNING id, email, role`,
      [merchant.rows[0].id, adminEmail, `Admin ${name}`, passwordHash],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify({ merchant: merchant.rows[0], staff: staff.rows[0] }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});