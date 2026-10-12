require("dotenv").config();
const argon2 = require("argon2");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://pos_app:Garasi79@localhost:5432/pos_hybrid";

const merchantId = "123e4567-e89b-12d3-a456-426614174000";
const staffId = "00000000-0000-0000-0000-000000000001";
const email = "admin@dev.local";
const password = "devpassword123";

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const passwordHash = await argon2.hash(password);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.merchant_id', $1, true)", [merchantId]);

      const merchantExists = await client.query(
        "SELECT id FROM merchants WHERE id = $1",
        [merchantId],
      );

      if (merchantExists.rowCount === 0) {
        await client.query(
          `INSERT INTO merchants (id, name, email, subscription_tier, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            merchantId,
            "Development Tenant",
            "merchant@dev.local",
            "pro",
            "active",
            { environment: "development" },
          ],
        );
      }

      const staffExists = await client.query(
        "SELECT id FROM staff WHERE LOWER(email) = LOWER($1)",
        [email],
      );

      if (staffExists.rowCount === 0) {
        await client.query(
          `INSERT INTO staff (id, merchant_id, email, name, role, password_hash, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [staffId, merchantId, email, "Developer Test User", "admin", passwordHash, true],
        );
      } else {
        await client.query(
          `UPDATE staff
           SET merchant_id = $2,
               name = $3,
               role = $4,
               password_hash = $5,
               is_active = true
           WHERE LOWER(email) = LOWER($1)`,
          [email, merchantId, "Developer Test User", "admin", passwordHash],
        );
      }

      await client.query("COMMIT");
      console.log("Development seed applied successfully");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Failed to seed development data:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
