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
const { computeTotals } = require("../src/services/transaction.service");
const { createTransactionSchema } = require("../src/schemas/pos.schema");
const request = supertest(app);

const RUN_ID = Date.now();
const MERCHANT_ID = crypto.randomUUID();
const ADMIN_EMAIL = `admin-orders-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "orderspass123";
let token;
let menuItemId;
let tableId;

test("ux-2: integer totals round discounts and tax explicitly", () => {
  const totals = computeTotals([
    { quantity: 1, unit_price: 101 },
    { quantity: 1, unit_price: 99 },
  ], { discountPct: 7.5, taxPct: 11 });

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discountAmount, 15);
  assert.equal(totals.taxAmount, 20);
  assert.equal(totals.grandTotal, 205);
  assert.equal(totals.items.reduce((sum, item) => sum + item.line_total, 0), 185);
  assert.equal(createTransactionSchema.safeParse({
    source: "qr",
    table_id: crypto.randomUUID(),
    items: [{ menu_item_id: crypto.randomUUID(), quantity: 1, unit_price: 1 }],
  }).success, true);
  assert.equal(createTransactionSchema.safeParse({
    source: "qr",
    items: [{ quantity: 1, unit_price: 1 }],
  }).success, false);
});

test("ux-2: setup merchant, catalog, and table", async () => {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Orders Tenant ${RUN_ID}`, ADMIN_EMAIL],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, 'Admin Orders', 'admin', $3)`,
      [MERCHANT_ID, ADMIN_EMAIL, passwordHash],
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
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "orders-test-device" });
  assert.equal(login.status, 200);
  token = login.body.access_token;

  const category = await request
    .post("/admin/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `Orders ${RUN_ID}` });
  assert.equal(category.status, 201);

  const menuItem = await request
    .post("/admin/menu-items")
    .set("Authorization", `Bearer ${token}`)
    .send({ category_id: category.body.data.id, name: "Kopi Susu", price: 18000 });
  assert.equal(menuItem.status, 201);
  menuItemId = menuItem.body.data.id;

  const table = await request
    .post("/admin/tables")
    .set("Authorization", `Bearer ${token}`)
    .send({ number: 1 });
  assert.equal(table.status, 201);
  tableId = table.body.data.id;
});

test("ux-2: daily numbers remain unique across concurrent orders", async () => {
  const orders = await Promise.all(
    Array.from({ length: 20 }, (_, index) => request
      .post("/pos/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ menu_item_id: menuItemId, quantity: 1, unit_price: 1 }],
        idempotency_key: `ux2-parallel-${RUN_ID}-${index}`,
      })),
  );

  assert.deepEqual(
    orders.map((response) => response.status),
    Array(20).fill(201),
    JSON.stringify(orders.map((response) => ({ status: response.status, error: response.body?.error }))),
  );
  const numbers = orders.map((response) => response.body.data.daily_number).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 20 }, (_, index) => index + 1));
});

test("ux-2: server prices catalog items and rounds percentage totals in rupiah", async () => {
  const response = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      items: [{ menu_item_id: menuItemId, quantity: 1, unit_price: 1, note: "Less sugar" }],
      discount_pct: 5.5,
      tax_pct: 11,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.items[0].unit_price, 18000);
  assert.equal(response.body.data.items[0].note, "Less sugar");
  assert.equal(Number(response.body.data.subtotal), 18000);
  assert.equal(Number(response.body.data.discount_amount), 990);
  assert.equal(Number(response.body.data.tax_amount), 1871);
  assert.equal(Number(response.body.data.grand_total), 18881);
  assert.equal(Number.isInteger(Number(response.body.data.grand_total)), true);
});

test("ux-2: QR orders remain drafts, unpaid, and excluded from sales reports", async () => {
  const before = await request
    .get("/pos/dashboard/today")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(before.status, 200);

  const response = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      source: "qr",
      order_type: "dine",
      table_id: tableId,
      customer_name: "Pelanggan",
      items: [{ menu_item_id: menuItemId, quantity: 1, unit_price: 1 }],
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.source, "qr");
  assert.equal(response.body.data.status, "draft");
  assert.equal(response.body.data.payment_status, "unpaid");
  assert.equal(response.body.data.fulfillment_status, "baru");
  assert.equal(response.body.data.table_number, 1);
  assert.ok(response.body.data.public_token);

  const after = await request
    .get("/pos/dashboard/today")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(after.status, 200);
  assert.equal(after.body.data.summary.transactions_count, before.body.data.summary.transactions_count);
  assert.equal(after.body.data.summary.total_sales, before.body.data.summary.total_sales);
});

test("ux-2: cleanup database pool", async () => {
  await closeDatabase();
});
