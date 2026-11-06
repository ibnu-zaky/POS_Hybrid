"use strict";

/**
 * Phase 3.1 Integration Tests — E-Commerce Connector
 *
 * Menguji:
 * 1. CRUD connections (dummy adapter)
 * 2. Sync orders dari dummy adapter
 * 3. List & filter orders
 * 4. Fulfill order (update status + tracking)
 * 5. Push inventory ke marketplace
 * 6. Validasi input → 400
 * 7. RLS: merchant lain tidak lihat connections/orders
 *
 * Merchant khusus diprovision inline (aman dari test paralel).
 * Menjalankan: npm test
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const argon2 = require("argon2");
const { Pool } = require("pg");
const supertest = require("supertest");

require("dotenv").config();

const app = require("../src/app");
const { closeDatabase } = require("../src/config/database");

const request = supertest(app);

const RUN_ID = Date.now();
const MERCHANT_ID = crypto.randomUUID();
const OTHER_MERCHANT_ID = crypto.randomUUID();
const ADMIN_EMAIL = `admin-ec-${RUN_ID}@dev.local`;
const PASSWORD = "ecpass12345";

let adminToken = null;
let connectionId = null;
let orderId = null;

async function getJson(url) {
  const res = await request
    .get(url)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200, `GET ${url} harus 200: ${JSON.stringify(res.body)}`);
  return res.body;
}

test("ecommerce: setup — provision merchant + admin", async () => {
  const passwordHash = await argon2.hash(PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Ecommerce Tenant ${RUN_ID}`, `merchant-ec-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Ecommerce", passwordHash],
    );

    // Merchant kedua untuk test RLS
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [OTHER_MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [OTHER_MERCHANT_ID, `Other Tenant ${RUN_ID}`, `merchant-other-ec-${RUN_ID}@dev.local`],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const login = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: PASSWORD, device_id: "ec-device" });
  assert.equal(login.status, 200);
  adminToken = login.body.access_token;
});

test("ecommerce: create connection — dummy adapter", async () => {
  const res = await request
    .post("/admin/ecommerce/connections")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      marketplace: "dummy",
      store_name: `Toko Dummy ${RUN_ID}`,
      api_key: "dummy-api-key",
      api_secret: "dummy-secret",
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.marketplace, "dummy");
  assert.equal(res.body.store_name, `Toko Dummy ${RUN_ID}`);
  assert.equal(res.body.status, "active");
  assert.ok(res.body.id, "connection punya id");
  connectionId = res.body.id;
});

test("ecommerce: create connection — duplikat store_name → 409", async () => {
  const res = await request
    .post("/admin/ecommerce/connections")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      marketplace: "dummy",
      store_name: `Toko Dummy ${RUN_ID}`,
    });
  assert.equal(res.status, 409);
});

test("ecommerce: create connection — marketplace tidak valid → 400", async () => {
  const res = await request
    .post("/admin/ecommerce/connections")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      marketplace: "invalid_marketplace",
      store_name: "Toko Invalid",
    });
  assert.equal(res.status, 400);
});

test("ecommerce: list connections — ada 1", async () => {
  const body = await getJson("/admin/ecommerce/connections");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, connectionId);
});

test("ecommerce: update connection — rename & deactivate", async () => {
  const res = await request
    .patch(`/admin/ecommerce/connections/${connectionId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ store_name: `Toko Dummy Renamed ${RUN_ID}`, status: "inactive" });
  assert.equal(res.status, 200);
  assert.equal(res.body.store_name, `Toko Dummy Renamed ${RUN_ID}`);
  assert.equal(res.body.status, "inactive");
});

test("ecommerce: sync — connection inactive → 400", async () => {
  const res = await request
    .post(`/admin/ecommerce/connections/${connectionId}/sync`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
});

test("ecommerce: reactivate & sync — pull orders dari dummy", async () => {
  // Reactivate dulu
  const reactivate = await request
    .patch(`/admin/ecommerce/connections/${connectionId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "active" });
  assert.equal(reactivate.status, 200);

  // Sync — dummy adapter dengan orders kosong (default)
  const res = await request
    .post(`/admin/ecommerce/connections/${connectionId}/sync`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0, "dummy default tanpa orders");
  assert.equal(res.body.created, 0);
});

test("ecommerce: push inventory — dummy adapter", async () => {
  const res = await request
    .post(`/admin/ecommerce/connections/${connectionId}/push-inventory`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      items: [
        { sku: "SKU-001", quantity: 10 },
        { sku: "SKU-002", quantity: 5 },
      ],
    });
  assert.equal(res.status, 200);
  assert.equal(res.body.pushed, 2);
  assert.equal(res.body.marketplace, "dummy");
});

test("ecommerce: push inventory — items kosong → 400", async () => {
  const res = await request
    .post(`/admin/ecommerce/connections/${connectionId}/push-inventory`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ items: [] });
  assert.equal(res.status, 400);
});

test("ecommerce: insert order manual via dummy adapter orders", async () => {
  // Untuk test orders, kita inject orders ke dummy adapter via direct DB insert
  // (karena dummy adapter default kosong). Simulasi order yang sudah di-sync.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);

    // Insert order langsung (seperti hasil sync)
    const orderRes = await client.query(
      `INSERT INTO ecommerce_orders (merchant_id, connection_id, marketplace_order_id, status, total, customer_name, customer_email, items)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [MERCHANT_ID, connectionId, `ORD-${RUN_ID}-001`, 150000, "Budi Santoso", "budi@email.com",
       JSON.stringify([{ sku: "SKU-001", product_name: "Produk A", quantity: 2, unit_price: 75000 }])],
    );
    orderId = orderRes.rows[0].id;

    await client.query(
      `INSERT INTO ecommerce_order_items (ecommerce_order_id, sku, product_name, quantity, unit_price)
       VALUES ($1, 'SKU-001', 'Produk A', 2, 75000)`,
      [orderId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

test("ecommerce: list orders — ada 1 order pending", async () => {
  const body = await getJson("/admin/ecommerce/orders?status=pending");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].marketplace_order_id, `ORD-${RUN_ID}-001`);
  assert.equal(body.data[0].total, "150000.00");
  assert.equal(body.data[0].customer_name, "Budi Santoso");
  assert.equal(body.data[0].marketplace, "dummy");
});

test("ecommerce: get order detail — items ikut terambil", async () => {
  const body = await getJson(`/admin/ecommerce/orders/${orderId}`);
  assert.equal(body.id, orderId);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].sku, "SKU-001");
  assert.equal(body.items[0].quantity, 2);
});

test("ecommerce: fulfill order — update status ke confirmed + tracking", async () => {
  const res = await request
    .patch(`/admin/ecommerce/orders/${orderId}/fulfill`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      status: "confirmed",
      tracking_number: "TRK-12345",
      carrier: "JNE",
    });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "confirmed");

  // Verify tracking tersimpan
  const detail = await getJson(`/admin/ecommerce/orders/${orderId}`);
  assert.equal(detail.raw_payload.tracking_number, "TRK-12345");
  assert.equal(detail.raw_payload.carrier, "JNE");
});

test("ecommerce: fulfill order — status invalid → 400", async () => {
  const res = await request
    .patch(`/admin/ecommerce/orders/${orderId}/fulfill`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "invalid_status" });
  assert.equal(res.status, 400);
});

test("ecommerce: order tidak ditemukan → 404", async () => {
  const res = await request
    .patch(`/admin/ecommerce/orders/${crypto.randomUUID()}/fulfill`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "confirmed" });
  assert.equal(res.status, 404);
});

test("ecommerce: RLS — connection dari merchant lain tidak terlihat", async () => {
  // Login sebagai merchant lain
  const otherPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const otherClient = await otherPool.connect();
  try {
    await otherClient.query("BEGIN");
    await otherClient.query("SELECT set_config('app.merchant_id', $1, true)", [OTHER_MERCHANT_ID]);
    // Insert admin untuk merchant lain
    const otherHash = await argon2.hash(PASSWORD);
    await otherClient.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, 'Other Admin', 'admin', $3)`,
      [OTHER_MERCHANT_ID, `admin-other-ec-${RUN_ID}@dev.local`, otherHash],
    );
    await otherClient.query("COMMIT");
  } finally {
    otherClient.release();
    await otherPool.end();
  }

  const otherLogin = await request
    .post("/auth/login")
    .set("X-Tenant-ID", OTHER_MERCHANT_ID)
    .send({ email: `admin-other-ec-${RUN_ID}@dev.local`, password: PASSWORD, device_id: "other-device" });
  assert.equal(otherLogin.status, 200);
  const otherToken = otherLogin.body.access_token;

  // List connections — harus kosong (tidak melihat punya merchant utama)
  const connections = await request
    .get("/admin/ecommerce/connections")
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(connections.status, 200);
  assert.equal(connections.body.data.length, 0, "merchant lain tidak melihat connections");

  // List orders — harus kosong
  const orders = await request
    .get("/admin/ecommerce/orders")
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(orders.status, 200);
  assert.equal(orders.body.data.length, 0, "merchant lain tidak melihat orders");
});

test("ecommerce: delete connection — hapus beserta orders (cascade)", async () => {
  const res = await request
    .delete(`/admin/ecommerce/connections/${connectionId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, true);

  // Verify orders ikut terhapus (cascade)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ecommerce_orders WHERE connection_id = $1`,
      [connectionId],
    );
    assert.equal(result.rows[0].total, 0, "orders ikut terhapus cascade");
  } finally {
    await pool.end();
  }
});

test("ecommerce: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
