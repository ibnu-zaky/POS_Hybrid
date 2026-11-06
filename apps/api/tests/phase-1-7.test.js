"use strict";

/**
 * Phase 1.7 Integration Tests — Dashboard & Reporting
 *
 * Menguji:
 * 1. GET /pos/dashboard/today — summary, payment_breakdown, top_products, hourly_sales (24 jam)
 * 2. GET /pos/reports/daily — konsisten dengan dashboard
 * 3. GET /pos/reports/weekly — 7 hari, hari ini terisi
 * 4. GET /pos/reports/monthly — N hari sesuai bulan, hari ini terisi
 * 5. Query date tidak valid → 400
 * 6. Filter rentang from/to pada dashboard
 *
 * Catatan: file test lain jalan paralel (node --test) dan menulis transaksi ke
 * merchant seed → test ini mem-provision merchant khusus supaya angka absolut aman.
 *
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
const ADMIN_EMAIL = `admin-dash-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "dashpass123";
const SKU_DASH = `DSH${RUN_ID}`;

let accessToken = null;
const createdTotal = { value: 0 };

function todayString() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function getDashboardToday() {
  const res = await request
    .get("/pos/dashboard/today")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  return res.body.data;
}

test("dashboard: setup — provision merchant khusus + login", async () => {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Dashboard Tenant ${RUN_ID}`, `merchant-dash-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Dashboard", passwordHash],
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
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "dash-device" });
  assert.equal(login.status, 200);
  accessToken = login.body.access_token;

  const dashboard = await getDashboardToday();
  assert.equal(dashboard.summary.transactions_count, 0, "merchant baru → 0 transaksi");
  assert.equal(dashboard.hourly_sales.length, 24, "hourly_sales selalu 24 baris");
});

test("dashboard: today — summary, breakdown, top products, hourly", async () => {
  const cash = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      items: [
        { product_name: `Kopi Dashboard ${RUN_ID}`, sku: SKU_DASH, quantity: 3, unit_price: 20000 },
        { product_name: `Teh Dashboard ${RUN_ID}`, quantity: 2, unit_price: 10000 },
      ],
      payment_method: "cash",
    });
  assert.equal(cash.status, 201);
  createdTotal.value = Number(cash.body.data.grand_total);

  const card = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      items: [{ product_name: `Kopi Dashboard ${RUN_ID}`, sku: SKU_DASH, quantity: 1, unit_price: 20000 }],
      payment_method: "card",
    });
  assert.equal(card.status, 201);
  createdTotal.value += Number(card.body.data.grand_total);

  const dashboard = await getDashboardToday();

  assert.equal(dashboard.summary.transactions_count, 2, "count = 2 transaksi");
  assert.ok(
    Math.abs(dashboard.summary.total_sales - createdTotal.value) < 0.01,
    "total_sales = jumlah grand_total",
  );
  assert.ok(
    Math.abs(dashboard.summary.average_ticket - createdTotal.value / 2) < 0.01,
    "average_ticket = total/count",
  );

  assert.ok(dashboard.payment_breakdown.cash.total > 0, "cash tercatat");
  assert.equal(dashboard.payment_breakdown.card.count, 1, "card tercatat 1x");
  assert.equal(dashboard.payment_breakdown.bank_transfer, undefined, "metode tanpa transaksi tidak muncul");

  const product = dashboard.top_products.find((p) => p.sku === SKU_DASH);
  assert.ok(product, "SKU uji ada di top_products");
  assert.equal(product.quantity, 4, "total quantity SKU uji = 3 + 1");
  assert.equal(dashboard.top_products[0].sku, SKU_DASH, "top product = revenue tertinggi");

  const hourlyTotal = dashboard.hourly_sales.reduce((sum, h) => sum + h.sales, 0);
  assert.ok(Math.abs(hourlyTotal - dashboard.summary.total_sales) < 0.01, "jumlah hourly = total_sales");
});

test("dashboard: laporan daily konsisten dengan dashboard", async () => {
  const res = await request
    .get(`/pos/reports/daily?date=${todayString()}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);

  const report = res.body.data;
  assert.equal(report.period.date, todayString());
  assert.equal(report.summary.transactions_count, 2);
  assert.equal(report.top_products[0].sku, SKU_DASH);
  assert.equal(report.payment_breakdown.cash.count, 1);
});

test("dashboard: weekly — 7 hari, hari ini terisi", async () => {
  const res = await request
    .get("/pos/reports/weekly")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);

  const report = res.body.data;
  assert.equal(report.days.length, 7);
  const today = report.days[report.days.length - 1];
  assert.equal(today.day, todayString());
  assert.equal(today.transactions, 2, "hari ini memuat 2 transaksi uji");
  assert.equal(report.summary.transactions_count, 2);
});

test("dashboard: monthly — jumlah hari benar, hari ini terisi", async () => {
  const month = todayString().slice(0, 7);
  const res = await request
    .get(`/pos/reports/monthly?month=${month}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);

  const report = res.body.data;
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  assert.equal(report.days.length, daysInMonth);
  const today = report.days.find((d) => d.day === todayString());
  assert.ok(today && today.transactions === 2, "hari ini terisi di laporan bulanan");
});

test("dashboard: query date tidak valid → 400", async () => {
  const daily = await request
    .get("/pos/reports/daily?date=31-12-2026")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(daily.status, 400);

  const monthly = await request
    .get("/pos/reports/monthly?month=2026-13")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(monthly.status, 400);

  const dash = await request
    .get("/pos/dashboard/today?from=2026-13-01")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(dash.status, 400);
});

test("dashboard: filter from/to pada dashboard", async () => {
  const today = todayString();
  const res = await request
    .get(`/pos/dashboard/today?from=${today}&to=${today}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.period, { from: today, to: today });
  assert.equal(res.body.data.summary.transactions_count, 2);
});

test("dashboard: tenant lain tidak terlihat (isolasi RLS)", async () => {
  const otherPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await otherPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [
      "123e4567-e89b-12d3-a456-426614174000",
    ]);
    const result = await client.query(
      "SELECT COUNT(*)::int AS total FROM transactions WHERE merchant_id = $1",
      [MERCHANT_ID],
    );
    assert.equal(result.rows[0].total, 0, "transaksi tenant dashboard tidak terlihat dari tenant lain");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await otherPool.end();
  }

  const dashboard = await getDashboardToday();
  assert.equal(dashboard.summary.transactions_count, 2);
});

test("dashboard: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
