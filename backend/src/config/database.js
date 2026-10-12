const { Pool } = require("pg");

const env = require("./env");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

async function checkDatabase() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0].ok === 1;
}

async function withTenantContext(merchantId, callback) {
  if (!merchantId) {
    throw new Error("merchantId is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [
      merchantId,
    ]);

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  checkDatabase,
  withTenantContext,
  closeDatabase,
};
