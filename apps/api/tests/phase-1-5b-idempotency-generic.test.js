"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const crypto = require("crypto");

require("dotenv").config();

const app = require("../src/app");
const request = supertest(app);

const RUN_ID = Date.now();
const MERCHANT_ID = crypto.randomUUID();
const ADMIN_EMAIL = `idempotency-admin-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "devpassword123";

let accessToken;

async function setup() {
  const { Pool } = require("pg");
  const argon2 = require("argon2");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const passHash = await argon2.hash(ADMIN_PASSWORD);

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status) VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Idem Merchant ${RUN_ID}`, ADMIN_EMAIL]
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash) VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Idem", passHash]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }
}

test("idempotency generik: setup", async () => {
  await setup();
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "idem-device" });
  assert.equal(res.status, 200);
  accessToken = res.body.access_token;
});

test("idempotency generik: payload berbeda dengan key sama -> 422", async () => {
  const key = `idem-key-${Date.now()}`;
  
  // Request 1
  const res1 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", key)
    .send({ items: [{ product_name: "A", quantity: 1, unit_price: 10000 }] });
  
  assert.equal(res1.status, 201);

  // Request 2 with different payload
  const res2 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", key)
    .send({ items: [{ product_name: "B_DIFFERENT", quantity: 2, unit_price: 20000 }] });

  assert.equal(res2.status, 422);
  assert.equal(res2.body.error, "IDEMPOTENCY_PAYLOAD_MISMATCH");
});

test("idempotency generik: paralel request dengan key sama -> 1 transaksi", async () => {
  const key = `idem-parallel-${Date.now()}`;
  const payload = { items: [{ product_name: "Parallel", quantity: 1, unit_price: 5000 }] };

  const [res1, res2] = await Promise.all([
    request
      .post("/pos/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send(payload),
    request
      .post("/pos/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", key)
      .send(payload)
  ]);

  const statuses = [res1.status, res2.status].sort();
  // Claim + simpan response terjadi dalam transaksi DB yang sama, sehingga
  // request kedua menunggu commit request pertama lalu mendapat hasil asli.
  assert.deepEqual(statuses, [200, 201]);

  // Pastikan hanya satu transaksi yang benar-benar dibuat untuk key ini.
  const list = await request
    .get("/pos/transactions?limit=100")
    .set("Authorization", `Bearer ${accessToken}`);
  const created = list.body.data.filter((t) => t.idempotency_key === key);
  assert.equal(created.length, 1, "hanya satu transaksi untuk satu key");
});
test("idempotency generik: request gagal tidak mengunci key -> retry berhasil", async () => {
  const sku = `IDEMFAIL${Date.now()}`;

  const inv = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku, product_name: `Idem Fail ${sku}`, quantity: 1, reorder_point: 0 });
  assert.equal(inv.status, 201);

  const key = `idem-fail-${Date.now()}`;
  const payload = {
    items: [{ product_name: "Idem Fail", sku, quantity: 5, unit_price: 1000 }],
    payment_method: "cash",
  };

  const failed = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", key)
    .send(payload);
  assert.equal(failed.status, 409);

  const adjust = await request
    .post(`/admin/inventory/${inv.body.data.id}/adjust`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ quantity: 10 });
  assert.equal(adjust.status, 200);

  const retry = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", key)
    .send(payload);
  assert.equal(retry.status, 201);
});
