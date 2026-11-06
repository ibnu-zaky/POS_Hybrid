const { pool } = require("../config/database");

async function tenantContext(request, response, next) {
  if (!request.auth?.merchant_id) {
    return response.status(401).json({ error: "Tenant context is missing" });
  }

  const client = await pool.connect();
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }

    cleaned = true;

    try {
      await client.query("COMMIT");
    } catch (_error) {
      try {
        await client.query("ROLLBACK");
      } catch (_rollbackError) {
        // ignore rollback errors in cleanup
      }
    } finally {
      client.release();
      delete request.db;
    }
  };

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [
      request.auth.merchant_id,
    ]);

    request.db = client;
    response.on("finish", cleanup);
    response.on("close", cleanup);

    return next();
  } catch (error) {
    client.release();
    return next(error);
  }
}

module.exports = tenantContext;
