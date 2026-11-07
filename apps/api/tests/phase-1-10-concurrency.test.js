"use strict";

/**
 * Phase 1.10 — Tes konkurensi stok
 *
 * Menguji anti-oversell atomik:
 * 1. Dua transaksi paralel berebut stok terakhir → tepat satu 201, satu 409.
 * 2. Stok akhir 0 (tidak negatif).
 * 3. Tidak ada movement ganda.
 *
 * Repeat 10 kali untuk memastikan deterministik.
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
const ADMIN_EMAIL = `admin-conc-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "concpass123";

let accessToken;

async function setup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const passHash = await argon2.hash(ADMIN_PASSWORD);

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status) VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Conc Tenant ${RUN_ID}`, ADMIN_EMAIL]
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash) VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Conc", passHash]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }

  const login = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "conc-device" });
  assert.equal(login.status, 200);
  accessToken = login.body.access_token;
}

async function getQuantity(sku) {
  const res = await request
    .get(`/pos/inventory/availability?sku=${sku}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  return res.body.data[sku]?.quantity;
}

async function setupSkuWithStock1(skuSuffix) {
  const sku = `CONC${RUN_ID}${skuSuffix}`;
  const inv = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku, product_name: `Conc Produk ${sku}`, quantity: 1, reorder_point: 0 });
  assert.equal(inv.status, 201);
  assert.equal(await getQuantity(sku), 1);
  return sku;
}

test("conc: setup", async () => {
  await setup();
});

test("conc: dua transaksi paralel stok 1 → tepat satu 201 satu 409, stok akhir 0", async () => {
  const sku = await setupSkuWithStock1("");
  const payload = () => ({
    items: [{ product_name: "Conc", sku, quantity: 1, unit_price: 10000 }],
    payment_method: "cash",
  });

  const [res1, res2] = await Promise.all([
    request.post("/pos/transactions").set("Authorization", `Bearer ${accessToken}`).send(payload()),
    request.post("/pos/transactions").set("Authorization", `Bearer ${accessToken}`).send(payload()),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [201, 409], "harus tepat satu sukses dan satu ditolak");
  assert.equal(await getQuantity(sku), 0, "stok akhir tepat 0");
});

test("conc: repeat 10 kali deterministik", async () => {
  for (let i = 0; i < 10; i++) {
    const suffix = `r${i}`;
    const sku = await setupSkuWithStock1(suffix);
    const payload = () => ({
      items: [{ product_name: "Conc", sku, quantity: 1, unit_price: 10000 }],
      payment_method: "cash",
    });

    const [res1, res2] = await Promise.all([
      request.post("/pos/transactions").set("Authorization", `Bearer ${accessToken}`).send(payload()),
      request.post("/pos/transactions").set("Authorization", `Bearer ${accessToken}`).send(payload()),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 409], `iteration ${i} harus deterministik`);
    assert.equal(await getQuantity(sku), 0, `iteration ${i} stok akhir 0`);
  }
});

test("conc: tidak ada movement ganda", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    const { rows } = await client.query(
      `SELECT sku, type, COUNT(*) AS movements
       FROM inventory_movements
       WHERE merchant_id = $1 AND sku LIKE $2 AND type = 'sale'
       GROUP BY sku, type`,
      [MERCHANT_ID, `CONC${RUN_ID}%`]
    );
    await client.query("COMMIT");

    for (const row of rows) {
      // setiap SKU dibeli 1x berhasil → tepat 1 movement sale dengan quantity -1
      assert.equal(Number(row.movements), 1, `SKU ${row.sku} hanya boleh punya 1 movement sale`);
    }
    assert.ok(rows.length >= 1, "harus ada movement yang tercatat");
  } finally {
    client.release();
    await pool.end();
  }
});

test("conc: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
