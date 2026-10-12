"use strict";

async function listByMerchant(client, { merchantId, status, limit, offset }) {
  const conditions = ["merchant_id = $1"];
  const params = [merchantId];
  let paramIdx = 2;

  if (status) { conditions.push(`status = $${paramIdx++}`); params.push(status); }
  params.push(limit, offset);

  const result = await client.query(
    `SELECT id, source_order_id, customer_name, customer_phone, reserved_items,
            pickup_code, status, reserved_at, expires_at, picked_up_at, notes, created_at, updated_at
     FROM click_and_collect_orders
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );
  return result.rows;
}

async function findById(client, { merchantId, id }) {
  const result = await client.query(
    `SELECT id, source_order_id, customer_name, customer_phone, reserved_items,
            pickup_code, status, reserved_at, expires_at, picked_up_at, picked_up_by, notes, created_at, updated_at
     FROM click_and_collect_orders
     WHERE merchant_id = $1 AND id = $2`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function findByPickupCode(client, { merchantId, pickupCode }) {
  const result = await client.query(
    `SELECT id, status, reserved_items, expires_at, customer_name
     FROM click_and_collect_orders
     WHERE merchant_id = $1 AND pickup_code = $2`,
    [merchantId, pickupCode],
  );
  return result.rows[0] || null;
}

async function create(client, { merchantId, sourceOrderId, customerName, customerPhone, reservedItems, pickupCode, notes }) {
  const result = await client.query(
    `INSERT INTO click_and_collect_orders (merchant_id, source_order_id, customer_name, customer_phone, reserved_items, pickup_code, expires_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours', $7)
     RETURNING id, source_order_id, customer_name, customer_phone, reserved_items, pickup_code, status, reserved_at, expires_at, notes, created_at`,
    [merchantId, sourceOrderId || null, customerName, customerPhone || null, JSON.stringify(reservedItems), pickupCode, notes || null],
  );
  return result.rows[0];
}

async function updateStatus(client, { merchantId, id, status, pickedUpBy }) {
  const sets = ["status = $3", "updated_at = NOW()"];
  const params = [merchantId, id, status];
  let paramIdx = 4;

  if (status === "picked_up") {
    sets.push(`picked_up_at = NOW()`);
    if (pickedUpBy) { sets.push(`picked_up_by = $${paramIdx++}`); params.push(pickedUpBy); }
  }

  const result = await client.query(
    `UPDATE click_and_collect_orders
     SET ${sets.join(", ")}
     WHERE merchant_id = $1 AND id = $2 AND status IN ('pending', 'ready')
     RETURNING id, status, picked_up_at`,
    params,
  );
  return result.rows[0] || null;
}

async function expirePending(client) {
  const result = await client.query(
    `UPDATE click_and_collect_orders
     SET status = 'expired', updated_at = NOW()
     WHERE status IN ('pending', 'ready') AND expires_at < NOW()
     RETURNING id, merchant_id, reserved_items`,
  );
  return result.rows;
}

module.exports = {
  listByMerchant,
  findById,
  findByPickupCode,
  create,
  updateStatus,
  expirePending,
};
