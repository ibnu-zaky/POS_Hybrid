"use strict";

const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const ecommerceRepository = require("../repositories/ecommerce.repository");
const { getAdapter } = require("../ecommerce/factory");

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(process.env.JWT_ACCESS_SECRET || "dev-secret", "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!text) return null;
  try {
    const [ivHex, dataHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(process.env.JWT_ACCESS_SECRET || "dev-secret", "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// ——— Connections ———

async function listConnections({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    return ecommerceRepository.listConnections(client, { merchantId });
  });
}

async function createConnection({ merchantId, marketplace, store_name, api_key, api_secret, webhook_url }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await ecommerceRepository.findConnectionByStore(client, { merchantId, storeName: store_name });
    if (existing) {
      throw Object.assign(new Error("Store name sudah terdaftar untuk merchant ini"), { statusCode: 409 });
    }

    // Verify adapter tersedia
    getAdapter(marketplace);

    const conn = await ecommerceRepository.createConnection(client, {
      merchantId,
      marketplace,
      storeName: store_name,
      apiKeyEncrypted: encrypt(api_key),
      apiSecretEncrypted: encrypt(api_secret),
      webhookUrl: webhook_url,
    });
    return conn;
  });
}

async function updateConnection({ merchantId, id, ...fields }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await ecommerceRepository.findConnectionById(client, { merchantId, id });
    if (!existing) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }

    const updateData = {};
    if (fields.store_name !== undefined) updateData.storeName = fields.store_name;
    if (fields.api_key !== undefined) updateData.apiKeyEncrypted = encrypt(fields.api_key);
    if (fields.api_secret !== undefined) updateData.apiSecretEncrypted = encrypt(fields.api_secret);
    if (fields.webhook_url !== undefined) updateData.webhookUrl = fields.webhook_url;
    if (fields.status !== undefined) updateData.status = fields.status;

    return ecommerceRepository.updateConnection(client, { merchantId, id, ...updateData });
  });
}

async function deleteConnection({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const deleted = await ecommerceRepository.deleteConnection(client, { merchantId, id });
    if (!deleted) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }
    return { deleted: true };
  });
}

// ——— Sync ———

async function syncOrders({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const conn = await ecommerceRepository.findConnectionById(client, { merchantId, id });
    if (!conn) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }
    if (conn.status !== "active") {
      throw Object.assign(new Error("Connection tidak aktif"), { statusCode: 400 });
    }

    const adapter = getAdapter(conn.marketplace, {
      store_name: conn.store_name,
      api_key: decrypt(conn.api_key_encrypted),
      api_secret: decrypt(conn.api_secret_encrypted),
    });

    const orders = await adapter.fetchOrders({
      since: conn.last_sync_at || undefined,
    });

    let created = 0;
    let updated = 0;

    for (const order of orders) {
      const existing = await ecommerceRepository.findOrderByMarketplaceId(client, {
        merchantId,
        connectionId: id,
        marketplaceOrderId: order.marketplace_order_id,
      });

      const upserted = await ecommerceRepository.upsertOrder(client, {
        merchantId,
        connectionId: id,
        marketplaceOrderId: order.marketplace_order_id,
        status: order.status,
        total: order.total,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        shippingAddress: order.shipping_address,
        items: order.items,
        rawPayload: order.raw_payload,
      });

      // Sync items
      await ecommerceRepository.deleteOrderItems(client, { orderId: upserted.id });
      if (order.items && order.items.length > 0) {
        await ecommerceRepository.insertOrderItems(client, {
          orderId: upserted.id,
          items: order.items,
        });
      }

      if (existing) updated++;
      else created++;
    }

    await ecommerceRepository.touchLastSync(client, { merchantId, id });

    return { created, updated, total: orders.length };
  });
}

async function pushInventory({ merchantId, id, items }) {
  return withTenantContext(merchantId, async (client) => {
    const conn = await ecommerceRepository.findConnectionById(client, { merchantId, id });
    if (!conn) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }

    const adapter = getAdapter(conn.marketplace, {
      store_name: conn.store_name,
      api_key: decrypt(conn.api_key_encrypted),
      api_secret: decrypt(conn.api_secret_encrypted),
    });

    return adapter.pushInventory(items);
  });
}

// ——— Orders ———

async function listOrders({ merchantId, status, from, to, limit, offset }) {
  return withTenantContext(merchantId, async (client) => {
    return ecommerceRepository.listOrders(client, { merchantId, status, from, to, limit, offset });
  });
}

async function fulfillOrder({ merchantId, id, status, tracking_number, carrier }) {
  return withTenantContext(merchantId, async (client) => {
    const updated = await ecommerceRepository.updateOrderStatus(client, { merchantId, id, status });
    if (!updated) {
      throw Object.assign(new Error("Order tidak ditemukan"), { statusCode: 404 });
    }

    // Update tracking info di raw_payload jika ada
    if (tracking_number || carrier) {
      const order = await client.query(
        `SELECT raw_payload FROM ecommerce_orders WHERE id = $1`,
        [id],
      );
      const payload = order.rows[0]?.raw_payload || {};
      if (tracking_number) payload.tracking_number = tracking_number;
      if (carrier) payload.carrier = carrier;
      await client.query(
        `UPDATE ecommerce_orders SET raw_payload = $2 WHERE id = $1`,
        [id, JSON.stringify(payload)],
      );
    }

    return updated;
  });
}

async function getOrderDetail({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const result = await client.query(
      `SELECT eo.*, ec.marketplace, ec.store_name
       FROM ecommerce_orders eo
       JOIN ecommerce_connections ec ON ec.id = eo.connection_id
       WHERE eo.merchant_id = $1 AND eo.id = $2`,
      [merchantId, id],
    );
    const order = result.rows[0];
    if (!order) {
      throw Object.assign(new Error("Order tidak ditemukan"), { statusCode: 404 });
    }
    const items = await ecommerceRepository.getOrderItems(client, { orderId: id });
    return { ...order, items };
  });
}

module.exports = {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  syncOrders,
  pushInventory,
  listOrders,
  fulfillOrder,
  getOrderDetail,
  encrypt,
  decrypt,
};
