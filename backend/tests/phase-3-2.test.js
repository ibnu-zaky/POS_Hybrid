"use strict";

/**
 * Phase 3.2 Integration Tests — Click & Collect
 *
 * Menguji:
 * 1. Create reservation (deduct stok hold)
 * 2. Validasi stok tidak cukup → 409, SKU tidak ada → 404
 * 3. List & get reservation
 * 4. Verify pickup (by pickup_code)
 * 5. Double pickup → 409
 * 6. Cancel (restock)
 * 7. Expire batch
 * 8. RLS cross-merchant
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
const OTHER_MERCHANT_ID = crypto.randomUUID();
const ADMIN_EMAIL = `admin-cnc-${RUN_ID}@dev.local`;
const PASSWORD = "cncpass12345";

const SKU_A = `CNCA${RUN_ID}`;
const SKU_B = `CNCB${RUN_ID}`;

let adminToken = null;
let reservationId = null;
let pickupCode = null;

async function getJson(url) {
  const res = await request.get(url).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200, `GET ${url} harus 200: ${JSON.stringify(res.body)}`);
  return res.body;
}

async function getStock(sku) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    const result = await client.query(
      `SELECT quantity FROM inventory WHERE merchant_id = $1 AND sku = $2`,
      [MERCHANT_ID, sku],
    );
    await client.query("COMMIT");
    return result.rows[0]?.quantity ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("cnc: setup — provision merchant + admin + inventory", async () => {
  const passwordHash = await argon2.hash(PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `CNC Tenant ${RUN_ID}`, `merchant-cnc-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin CNC", passwordHash],
    );

    await client.query("SELECT set_config('app.merchant_id', $1, true)", [OTHER_MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [OTHER_MERCHANT_ID, `Other CNC ${RUN_ID}`, `merchant-other-cnc-${RUN_ID}@dev.local`],
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
    .send({ email: ADMIN_EMAIL, password: PASSWORD, device_id: "cnc-device" });
  assert.equal(login.status, 200);
  adminToken = login.body.access_token;

  // Seed inventory
  for (const item of [
    { sku: SKU_A, product_name: `Produk A ${RUN_ID}`, quantity: 50, reorder_point: 5, unit_cost: 10000 },
    { sku: SKU_B, product_name: `Produk B ${RUN_ID}`, quantity: 20, reorder_point: 5, unit_cost: 5000 },
  ]) {
    const res = await request
      .post("/admin/inventory")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(item);
    assert.equal(res.status, 201);
  }
});

test("cnc: create reservation — deduct stok hold", async () => {
  const stockBefore = await getStock(SKU_A);
  assert.equal(stockBefore, 50);

  const res = await request
    .post("/admin/click-and-collect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customer_name: "Budi Santoso",
      customer_phone: "081234567890",
      items: [
        { sku: SKU_A, product_name: `Produk A ${RUN_ID}`, quantity: 3 },
      ],
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, "pending");
  assert.ok(res.body.pickup_code, "pickup_code ada");
  assert.equal(res.body.reserved_items.length, 1);
  reservationId = res.body.id;
  pickupCode = res.body.pickup_code;

  const stockAfter = await getStock(SKU_A);
  assert.equal(stockAfter, 47, "stok berkurang 3 (hold)");
});

test("cnc: create — stok tidak cukup → 409", async () => {
  const res = await request
    .post("/admin/click-and-collect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customer_name: "Test Over",
      items: [{ sku: SKU_B, product_name: "B", quantity: 999 }],
    });
  assert.equal(res.status, 409);
});

test("cnc: create — SKU tidak ditemukan → 404", async () => {
  const res = await request
    .post("/admin/click-and-collect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customer_name: "Test NotFound",
      items: [{ sku: `NONEXIST${RUN_ID}`, product_name: "X", quantity: 1 }],
    });
  assert.equal(res.status, 404);
});

test("cnc: list reservations — ada 1 pending", async () => {
  const body = await getJson("/admin/click-and-collect?status=pending");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, reservationId);
  assert.equal(body.data[0].customer_name, "Budi Santoso");
});

test("cnc: get reservation detail", async () => {
  const body = await getJson(`/admin/click-and-collect/${reservationId}`);
  assert.equal(body.id, reservationId);
  assert.equal(body.pickup_code, pickupCode);
  assert.equal(body.reserved_items[0].sku, SKU_A);
});

test("cnc: verify pickup — by pickup_code", async () => {
  const res = await request
    .post("/admin/click-and-collect/verify")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ pickup_code: pickupCode });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "picked_up");
  assert.ok(res.body.picked_up_at, "picked_up_at terisi");

  // Stok tidak berubah (sudah di-deduct saat reserve)
  const stock = await getStock(SKU_A);
  assert.equal(stock, 47, "stok tidak berubah setelah pickup");
});

test("cnc: double pickup → 409", async () => {
  const res = await request
    .post("/admin/click-and-collect/verify")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ pickup_code: pickupCode });
  assert.equal(res.status, 409);
});

test("cnc: cancel — restock", async () => {
  // Buat reservasi baru untuk di-cancel
  const create = await request
    .post("/admin/click-and-collect")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      customer_name: "Cancel Test",
      items: [{ sku: SKU_B, product_name: `Produk B ${RUN_ID}`, quantity: 5 }],
    });
  assert.equal(create.status, 201);
  const cancelId = create.body.id;

  const stockAfterReserve = await getStock(SKU_B);
  assert.equal(stockAfterReserve, 15, "stok berkurang 5");

  const res = await request
    .post(`/admin/click-and-collect/${cancelId}/cancel`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "cancelled");

  const stockAfterCancel = await getStock(SKU_B);
  assert.equal(stockAfterCancel, 20, "stok kembali penuh setelah cancel");
});

test("cnc: cancel picked_up → 409", async () => {
  const res = await request
    .post(`/admin/click-and-collect/${reservationId}/cancel`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test("cnc: expire batch — tidak ada yang expired (masih dalam 24 jam)", async () => {
  const res = await request
    .post("/admin/click-and-collect/expire")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.expired, 0);
});

test("cnc: RLS — merchant lain tidak melihat reservasi", async () => {
  // Setup admin merchant lain
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [OTHER_MERCHANT_ID]);
    const otherHash = await argon2.hash(PASSWORD);
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, 'Other CNC Admin', 'admin', $3)`,
      [OTHER_MERCHANT_ID, `admin-other-cnc-${RUN_ID}@dev.local`, otherHash],
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }

  const otherLogin = await request
    .post("/auth/login")
    .set("X-Tenant-ID", OTHER_MERCHANT_ID)
    .send({ email: `admin-other-cnc-${RUN_ID}@dev.local`, password: PASSWORD, device_id: "other" });
  assert.equal(otherLogin.status, 200);
  const otherToken = otherLogin.body.access_token;

  const list = await request
    .get("/admin/click-and-collect")
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 0, "merchant lain tidak melihat reservasi");

  // Verify pickup dengan kode milik merchant utama → 404
  const verify = await request
    .post("/admin/click-and-collect/verify")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ pickup_code: pickupCode });
  assert.equal(verify.status, 404, "pickup code merchant lain tidak terlihat");
});

test("cnc: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
