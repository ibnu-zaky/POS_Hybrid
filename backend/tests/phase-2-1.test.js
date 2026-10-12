"use strict";

/**
 * Phase 2.1 Integration Tests — Advanced Analytics (DB-native)
 *
 * Menguji:
 * 1. GET /admin/analytics/sales-by-product — agregat penjualan per SKU
 * 2. GET /admin/analytics/margin — estimasi COGS & margin pakai inventory.unit_cost
 * 3. GET /admin/analytics/slow-moving — SKU tanpa penjualan N hari
 * 4. GET /admin/analytics/turnover — rasio sold/current_stock (estimasi)
 * 5. Validasi query date → 400
 * 6. View security_invoker — tanpa tenant context, pos_app tidak melihat baris
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
const ADMIN_EMAIL = `admin-ana-${RUN_ID}@dev.local`;
const PASSWORD = "anapass123";

const SKU_A = `ANAA${RUN_ID}`;
const SKU_B = `ANAB${RUN_ID}`;
const SKU_SLOW = `ANAS${RUN_ID}`;

let adminToken = null;

function todayString() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function getJson(url) {
  const res = await request
    .get(url)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200, `GET ${url} harus 200: ${JSON.stringify(res.body)}`);
  return res.body;
}

test("analytics: setup — provision merchant + admin + seed inventory & transaksi", async () => {
  const passwordHash = await argon2.hash(PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Analytics Tenant ${RUN_ID}`, `merchant-ana-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Analytics", passwordHash],
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
    .send({ email: ADMIN_EMAIL, password: PASSWORD, device_id: "ana-device" });
  assert.equal(login.status, 200);
  adminToken = login.body.access_token;

  for (const item of [
    { sku: SKU_A, product_name: `Produk A ${RUN_ID}`, quantity: 100, reorder_point: 5, unit_cost: 10000 },
    { sku: SKU_B, product_name: `Produk B ${RUN_ID}`, quantity: 50, reorder_point: 5, unit_cost: null },
    { sku: SKU_SLOW, product_name: `Produk Slow ${RUN_ID}`, quantity: 30, reorder_point: 5, unit_cost: 2000 },
  ]) {
    const res = await request
      .post("/admin/inventory")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(item);
    assert.equal(res.status, 201, `inventory ${item.sku} dibuat`);
  }

  const txn1 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      items: [
        { product_name: `Produk A ${RUN_ID}`, sku: SKU_A, quantity: 2, unit_price: 20000 },
        { product_name: `Produk B ${RUN_ID}`, sku: SKU_B, quantity: 1, unit_price: 15000 },
      ],
    });
  assert.equal(txn1.status, 201);

  const txn2 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      items: [
        { product_name: `Produk A ${RUN_ID}`, sku: SKU_A, quantity: 3, unit_price: 20000 },
      ],
    });
  assert.equal(txn2.status, 201);
});

test("analytics: sales-by-product — agregat per SKU", async () => {
  const body = await getJson(`/admin/analytics/sales-by-product?from=${todayString()}&to=${todayString()}`);

  assert.deepEqual(body.period, { from: todayString(), to: todayString() });

  const productA = body.data.find((row) => row.sku === SKU_A);
  const productB = body.data.find((row) => row.sku === SKU_B);
  assert.ok(productA, "SKU_A ada");
  assert.equal(productA.quantity, 5, "SKU_A terjual 2 + 3");
  assert.equal(productA.revenue, 100000);
  assert.ok(productB, "SKU_B ada");
  assert.equal(productB.quantity, 1);
  assert.equal(productB.revenue, 15000);
  assert.equal(body.data[0].sku, SKU_A, "urutan by revenue desc");
});

test("analytics: margin — estimasi COGS dari unit_cost", async () => {
  const body = await getJson(`/admin/analytics/margin?from=${todayString()}&to=${todayString()}`);

  const productA = body.data.find((row) => row.sku === SKU_A);
  assert.ok(productA);
  assert.equal(productA.has_cost, true);
  assert.equal(productA.estimated_cogs, 50000, "5 unit × cost 10.000");
  assert.ok(Math.abs(productA.margin_ratio - 0.5) < 0.001, "margin 50%");

  const productB = body.data.find((row) => row.sku === SKU_B);
  assert.ok(productB);
  assert.equal(productB.has_cost, false, "unit_cost null → has_cost false");
  assert.equal(productB.estimated_cogs, 0);
  assert.equal(productB.margin_ratio, 1, "tanpa cost, margin dianggap 100% (tanpa COGS)");
});

test("analytics: slow-moving — SKU tanpa penjualan N hari", async () => {
  const body = await getJson(`/admin/analytics/slow-moving?days=1`);

  const slow = body.data.find((row) => row.sku === SKU_SLOW);
  assert.ok(slow, "SKU_SLOW (tidak pernah terjual) ada di slow-moving");
  assert.equal(slow.quantity, 30);

  assert.equal(body.data.find((row) => row.sku === SKU_A), undefined, "SKU_A baru terjual hari ini → tidak slow");
  assert.equal(body.data.find((row) => row.sku === SKU_B), undefined, "SKU_B baru terjual hari ini → tidak slow");
});

test("analytics: turnover — sold/current_stock estimasi", async () => {
  const body = await getJson(`/admin/analytics/turnover?from=${todayString()}&to=${todayString()}`);

  assert.ok(body.note, "catatan estimasi ikut dikirim");
  const productA = body.data.find((row) => row.sku === SKU_A);
  assert.ok(productA);
  assert.equal(productA.sold_quantity, 5);
  assert.equal(productA.current_stock, 95, "stok setelah deduksi: 100 - 5");
  assert.ok(Math.abs(productA.turnover_ratio - 5 / 95) < 0.001);
});

test("analytics: query tidak valid → 400", async () => {
  const bad = await request
    .get("/admin/analytics/sales-by-product?from=2026-13-45")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(bad.status, 400);

  const badDays = await request
    .get("/admin/analytics/slow-moving?days=0")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(badDays.status, 400);
});

test("analytics: view security_invoker — tanpa tenant context tidak terlihat", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      "SELECT COUNT(*)::int AS total FROM v_daily_sales WHERE merchant_id = $1",
      [MERCHANT_ID],
    );
    assert.equal(result.rows[0].total, 0, "tanpa app.merchant_id, RLS menyembunyikan baris");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
      const visible = await client.query(
        "SELECT COUNT(*)::int AS total FROM v_daily_sales WHERE merchant_id = $1",
        [MERCHANT_ID],
      );
      assert.ok(visible.rows[0].total > 0, "dengan tenant context, baris terlihat");
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
});

test("analytics: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
