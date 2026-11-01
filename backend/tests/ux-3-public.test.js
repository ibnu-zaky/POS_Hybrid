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
const ADMIN_EMAIL = `admin-public-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "publicpass123";

let tableToken;
let menuItemId;
let orderId;
let publicToken;

async function setup() {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Public Tenant ${RUN_ID}`, ADMIN_EMAIL],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin", passwordHash],
    );
    const cat = await client.query(
      "INSERT INTO categories (merchant_id, name) VALUES ($1, 'Drinks') RETURNING id",
      [MERCHANT_ID],
    );
    const item = await client.query(
      "INSERT INTO menu_items (merchant_id, category_id, name, price) VALUES ($1, $2, 'Kopi', 10000) RETURNING id",
      [MERCHANT_ID, cat.rows[0].id],
    );
    menuItemId = item.rows[0].id;

    const table = await client.query(
      "INSERT INTO dining_tables (merchant_id, number, token) VALUES ($1, 1, $2) RETURNING token",
      [MERCHANT_ID, `table-token-${RUN_ID}`],
    );
    tableToken = table.rows[0].token;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("ux-3: setup", async () => {
  await setup();
});

test("ux-3: GET /public/tables/:token/menu", async () => {
  const res = await request.get(`/public/tables/${tableToken}/menu`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.table_number, 1);
  assert.ok(Array.isArray(res.body.data.categories));
  assert.ok(Array.isArray(res.body.data.items));
});

test("ux-3: POST /public/tables/:token/orders (Idempotency)", async () => {
  const payload = {
    items: [{ menu_item_id: menuItemId, quantity: 1 }],
    customer_name: "John Doe",
  };
  const idem = crypto.randomUUID();
  const res = await request
    .post(`/public/tables/${tableToken}/orders`)
    .set("Idempotency-Key", idem)
    .send(payload);

  assert.equal(res.status, 201);
  assert.ok(res.body.data.order_id);
  orderId = res.body.data.order_id;
  publicToken = res.body.data.public_token;

  const res2 = await request
    .post(`/public/tables/${tableToken}/orders`)
    .set("Idempotency-Key", idem)
    .send(payload);

  assert.equal(res2.status, 200);
  assert.equal(res2.body.data.order_id, orderId);
});

test("ux-3: GET /public/orders/:id?pt=... status", async () => {
  const res = await request.get(`/public/orders/${orderId}?pt=${publicToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, orderId);
  assert.equal(res.body.data.fulfillment_status, "baru");
});

test("ux-3: cleanup", async () => {
  await closeDatabase();
});
