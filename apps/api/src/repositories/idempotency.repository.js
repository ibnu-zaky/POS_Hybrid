"use strict";

async function claim(client, { merchantId, key, hash }) {
  const result = await client.query(
    `INSERT INTO idempotency_keys (merchant_id, key, request_hash, response_status, response_body)
     VALUES ($1, $2, $3, 0, '{}')
     ON CONFLICT (merchant_id, key) DO NOTHING
     RETURNING *`,
    [merchantId, key, hash]
  );
  
  if (result.rows[0]) return { row: result.rows[0], claimed: true };
  
  const existing = await client.query(
    `SELECT * FROM idempotency_keys WHERE merchant_id = $1 AND key = $2`,
    [merchantId, key]
  );
  
  return { row: existing.rows[0], claimed: false };
}

async function complete(client, { merchantId, key, status, body }) {
  await client.query(
    `UPDATE idempotency_keys SET response_status = $3, response_body = $4 WHERE merchant_id = $1 AND key = $2`,
    [merchantId, key, status, JSON.stringify(body)]
  );
}

module.exports = { claim, complete };