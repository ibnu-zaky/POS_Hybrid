"use strict";

// ——— Connections ———

async function listConnections(client, { merchantId }) {
  const result = await client.query(
    `SELECT id, marketplace, store_name, webhook_url, status, last_sync_at, created_at, updated_at
     FROM ecommerce_connections
     WHERE merchant_id = $1
     ORDER BY created_at DESC`,
    [merchantId],
  );
  return result.rows;
}

async function findConnectionById(client, { merchantId, id }) {
  const result = await client.query(
    `SELECT id, marketplace, store_name, api_key_encrypted, api_secret_encrypted,
            webhook_url, status, last_sync_at, created_at, updated_at
     FROM ecommerce_connections
     WHERE merchant_id = $1 AND id = $2`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function findConnectionByStore(client, { merchantId, storeName }) {
  const result = await client.query(
    `SELECT id FROM ecommerce_connections
     WHERE merchant_id = $1 AND store_name = $2`,
    [merchantId, storeName],
  );
  return result.rows[0] || null;
}

async function createConnection(client, { merchantId, marketplace, storeName, apiKeyEncrypted, apiSecretEncrypted, webhookUrl }) {
  const result = await client.query(
    `INSERT INTO ecommerce_connections (merchant_id, marketplace, store_name, api_key_encrypted, api_secret_encrypted, webhook_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, marketplace, store_name, webhook_url, status, created_at`,
    [merchantId, marketplace, storeName, apiKeyEncrypted, apiSecretEncrypted, webhookUrl || null],
  );
  return result.rows[0];
}

async function updateConnection(client, { merchantId, id, storeName, apiKeyEncrypted, apiSecretEncrypted, webhookUrl, status }) {
  const sets = [];
  const params = [merchantId, id];
  let paramIdx = 3;

  if (storeName !== undefined) { sets.push(`store_name = $${paramIdx++}`); params.push(storeName); }
  if (apiKeyEncrypted !== undefined) { sets.push(`api_key_encrypted = $${paramIdx++}`); params.push(apiKeyEncrypted); }
  if (apiSecretEncrypted !== undefined) { sets.push(`api_secret_encrypted = $${paramIdx++}`); params.push(apiSecretEncrypted); }
  if (webhookUrl !== undefined) { sets.push(`webhook_url = $${paramIdx++}`); params.push(webhookUrl); }
  if (status !== undefined) { sets.push(`status = $${paramIdx++}`); params.push(status); }

  sets.push(`updated_at = NOW()`);

  const result = await client.query(
    `UPDATE ecommerce_connections
     SET ${sets.join(", ")}
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, marketplace, store_name, webhook_url, status, updated_at`,
    params,
  );
  return result.rows[0] || null;
}

async function deleteConnection(client, { merchantId, id }) {
  const result = await client.query(
    `DELETE FROM ecommerce_connections WHERE merchant_id = $1 AND id = $2 RETURNING id`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function touchLastSync(client, { merchantId, id }) {
  await client.query(
    `UPDATE ecommerce_connections SET last_sync_at = NOW(), updated_at = NOW() WHERE merchant_id = $1 AND id = $2`,
    [merchantId, id],
  );
}

// ——— Orders ———

async function listOrders(client, { merchantId, status, from, to, limit, offset }) {
  const conditions = ["eo.merchant_id = $1"];
  const params = [merchantId];
  let paramIdx = 2;

  if (status) { conditions.push(`eo.status = $${paramIdx++}`); params.push(status); }
  if (from) { conditions.push(`eo.created_at >= $${paramIdx++}::date`); params.push(from); }
  if (to) { conditions.push(`eo.created_at < ($${paramIdx++}::date + INTERVAL '1 day')`); params.push(to); }

  params.push(limit, offset);

  const result = await client.query(
    `SELECT eo.id, eo.marketplace_order_id, eo.status, eo.total, eo.customer_name,
            eo.customer_email, eo.shipping_address, eo.items, eo.synced_at, eo.created_at, eo.updated_at,
            ec.marketplace, ec.store_name
     FROM ecommerce_orders eo
     JOIN ecommerce_connections ec ON ec.id = eo.connection_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY eo.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );
  return result.rows;
}

async function findOrderByMarketplaceId(client, { merchantId, connectionId, marketplaceOrderId }) {
  const result = await client.query(
    `SELECT id, status, total, customer_name, customer_email, shipping_address, items, raw_payload, created_at
     FROM ecommerce_orders
     WHERE merchant_id = $1 AND connection_id = $2 AND marketplace_order_id = $3`,
    [merchantId, connectionId, marketplaceOrderId],
  );
  return result.rows[0] || null;
}

async function upsertOrder(client, { merchantId, connectionId, marketplaceOrderId, status, total, customerName, customerEmail, shippingAddress, items, rawPayload }) {
  const result = await client.query(
    `INSERT INTO ecommerce_orders (merchant_id, connection_id, marketplace_order_id, status, total, customer_name, customer_email, shipping_address, items, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (connection_id, marketplace_order_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       total = EXCLUDED.total,
       customer_name = EXCLUDED.customer_name,
       customer_email = EXCLUDED.customer_email,
       shipping_address = EXCLUDED.shipping_address,
       items = EXCLUDED.items,
       raw_payload = EXCLUDED.raw_payload,
       synced_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [merchantId, connectionId, marketplaceOrderId, status, total, customerName || null, customerEmail || null, shippingAddress || null, JSON.stringify(items), rawPayload || null],
  );
  return result.rows[0];
}

async function updateOrderStatus(client, { merchantId, id, status }) {
  const result = await client.query(
    `UPDATE ecommerce_orders
     SET status = $3, updated_at = NOW()
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, status, updated_at`,
    [merchantId, id, status],
  );
  return result.rows[0] || null;
}

async function getOrderItems(client, { orderId }) {
  const result = await client.query(
    `SELECT id, sku, product_name, quantity, unit_price
     FROM ecommerce_order_items
     WHERE ecommerce_order_id = $1
     ORDER BY created_at`,
    [orderId],
  );
  return result.rows;
}

async function insertOrderItems(client, { orderId, items }) {
  for (const item of items) {
    await client.query(
      `INSERT INTO ecommerce_order_items (ecommerce_order_id, sku, product_name, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, item.sku || null, item.product_name, item.quantity, item.unit_price],
    );
  }
}

async function deleteOrderItems(client, { orderId }) {
  await client.query(`DELETE FROM ecommerce_order_items WHERE ecommerce_order_id = $1`, [orderId]);
}

module.exports = {
  listConnections,
  findConnectionById,
  findConnectionByStore,
  createConnection,
  updateConnection,
  deleteConnection,
  touchLastSync,
  listOrders,
  findOrderByMarketplaceId,
  upsertOrder,
  updateOrderStatus,
  getOrderItems,
  insertOrderItems,
  deleteOrderItems,
};
