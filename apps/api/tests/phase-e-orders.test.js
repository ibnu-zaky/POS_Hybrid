"use strict";

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
const ADMIN_EMAIL = `admin-phase-e-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "phaseepass123";

let accessToken = null;
let orderId = null;
let setupData = null;

async function loginAdmin() {
  const login = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "phase-e-device" });

  assert.equal(login.status, 200);
  return login.body.access_token;
}

async function setup() {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);

    // Merchant
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Phase E Tenant ${RUN_ID}`, ADMIN_EMAIL],
    );

    // Admin staff
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Phase E", passwordHash],
    );

    // Kategori + menu
    const cat = await client.query(
      "INSERT INTO categories (merchant_id, name) VALUES ($1, 'Drinks') RETURNING id",
      [MERCHANT_ID],
    );
    const item = await client.query(
      "INSERT INTO menu_items (merchant_id, category_id, name, price) VALUES ($1, $2, 'Kopi', 10000) RETURNING id",
      [MERCHANT_ID, cat.rows[0].id],
    );
    const menuItemId = item.rows[0].id;

    // Meja untuk QR
    const table = await client.query(
      "INSERT INTO dining_tables (merchant_id, number, token) VALUES ($1, 1, $2) RETURNING id, token",
      [MERCHANT_ID, `table-phase-e-${RUN_ID}`],
    );
    const tableId = table.rows[0].id;
    const tableToken = table.rows[0].token;

    await client.query("COMMIT");

    return { menuItemId, tableId, tableToken };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("phase-e: setup tenant", async () => {
  setupData = await setup();
});

test("phase-e: login admin", async () => {
  accessToken = await loginAdmin();
});

test("phase-e: buat order QR (draft, belum lunas)", async () => {
  const { menuItemId, tableId, tableToken } = setupData;

  const order = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      source: "qr",
      order_type: "dine",
      table_id: tableId,
      customer_name: "Customer Phase E",
      items: [{ menu_item_id: menuItemId, quantity: 2, unit_price: 1 }],
    });

  assert.equal(order.status, 201);
  assert.equal(order.body.data.source, "qr");
  assert.equal(order.body.data.status, "draft");
  assert.equal(order.body.data.fulfillment_status, "baru");
  assert.equal(order.body.data.payment_status, "unpaid");
  assert.ok(order.body.data.public_token);
  orderId = order.body.data.id;
});

test("phase-e: PATCH /pos/orders/:id/status (diterima → diproses)", async () => {
  const order = await request
    .patch(`/pos/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ fulfillment_status: "diproses" });

  assert.equal(order.status, 200);
  assert.equal(order.body.data.fulfillment_status, "diproses");
});

test("phase-e: PATCH /pos/orders/:id/status (diproses → siap)", async () => {
  const order = await request
    .patch(`/pos/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ fulfillment_status: "siap" });

  assert.equal(order.status, 200);
  assert.equal(order.body.data.fulfillment_status, "siap");
});

test("phase-e: PATCH /pos/orders/:id/status (siap → selesai) perlu paid", async () => {
  const order = await request
    .patch(`/pos/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ fulfillment_status: "selesai" });

  assert.equal(order.status, 409);
  assert.match(order.body.error, /Cannot finish order without payment/);
});

test("phase-e: POST /pos/orders/:id/pay (manual cash)", async () => {
  const pay = await request
    .post(`/pos/orders/${orderId}/pay`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ payment_method: "cash", amount_paid: 22200 });

  assert.equal(pay.status, 200);
  assert.equal(pay.body.data.payment_status, "paid");
});

test("phase-e: PATCH /pos/orders/:id/status (selesai setelah dibayar)", async () => {
  const order = await request
    .patch(`/pos/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ fulfillment_status: "selesai" });

  assert.equal(order.status, 200);
  assert.equal(order.body.data.fulfillment_status, "selesai");
  assert.equal(order.body.data.payment_status, "paid");
});

test("phase-e: list /pos/orders dengan filter", async () => {
  const list = await request
    .get("/pos/orders")
    .set("Authorization", `Bearer ${accessToken}`)
    .query({ status: "baru", limit: 10, offset: 0 });

  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.data));
});

test("phase-e: list /pos/orders dengan filter source=qr", async () => {
  const list = await request
    .get("/pos/orders")
    .set("Authorization", `Bearer ${accessToken}`)
    .query({ source: "qr", limit: 10 });

  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
});

test("phase-e: SSE stream orders", async () => {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  const stream = await request
    .get("/pos/orders/stream")
    .set("Authorization", `Bearer ${accessToken}`)
    .timeout(200);

  assert.equal(stream.status, 200);
  assert.equal(stream.headers["content-type"], "text/event-stream");
});

test("phase-e: cleanup", async () => {
  await closeDatabase();
});
