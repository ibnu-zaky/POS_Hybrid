"use strict";

const { pool } = require("../config/database");

async function getOrderStream(request, response, next) {
  const merchantId = request.auth.merchant_id;
  const since = request.query.since ? Number(request.query.since) : 0;
  let client;

  try {
    client = await pool.connect();
  } catch (error) {
    return next(error);
  }

  await client.query("BEGIN");
  await client.query("SELECT set_config('app.merchant_id', $1, false)", [merchantId]);

  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendEvent = (event, data) => {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent("connected", {
    merchant_id: merchantId,
    staff_id: request.auth.sub,
    timestamp: Date.now(),
  });

  let lastEventId = since || Date.now();
  let closed = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    clearInterval(pollInterval);
    clearInterval(heartbeat);
    try {
      await client.query("ROLLBACK");
    } catch {}
    client.release();
  };

  const pollInterval = setInterval(async () => {
    if (closed) return;
    try {
      const { rows } = await client.query(
        `SELECT id, order_number, fulfillment_status, payment_status, total, created_at, updated_at
         FROM transactions
         WHERE merchant_id = $1 AND updated_at > to_timestamp($2 / 1000.0)
         ORDER BY updated_at ASC
         LIMIT 50`,
        [merchantId, lastEventId],
      );

      for (const row of rows) {
        lastEventId = Math.max(lastEventId, new Date(row.updated_at).getTime());
        sendEvent("order_update", row);
      }
    } catch (error) {
      sendEvent("error", { message: error.message });
    }
  }, 3_000);

  const heartbeat = setInterval(() => {
    if (!closed) {
      response.write(`: heartbeat\n\n`);
    }
  }, 15_000);

  request.on("close", cleanup);
  response.on("close", cleanup);
}

module.exports = {
  getOrderStream,
};
