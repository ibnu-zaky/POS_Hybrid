"use strict";

/**
 * Fase UX A — Hardening sisa (sisa Phase 4.2–4.3)
 *
 * Menguji:
 * 1. Pagination validasi: limit/offset invalid → 400, default 20/0
 * 2. Error handler: invalid UUID → 400, duplicate key → 409
 * 3. (Regresi) CORS sudah dicakup phase-4-hardening.test.js
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
const ADMIN_EMAIL = `admin-ux0-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "ux0pass123";

let accessToken = null;

async function loginAdmin() {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `UX0 Tenant ${RUN_ID}`, `merchant-ux0-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin UX0", passwordHash],
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
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "ux0-device" });
  assert.equal(login.status, 200);
  accessToken = login.body.access_token;
}

test("ux-0: setup — provision merchant + login", async () => {
  await loginAdmin();
});

test("ux-0: pagination limit invalid (non-integer) → 400", async () => {
  const res = await request
    .get("/pos/transactions?limit=abc")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
  assert.ok(res.body.error === "Invalid request");
});

test("ux-0: pagination limit negative → 400", async () => {
  const res = await request
    .get("/pos/transactions?limit=-1")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
});

test("ux-0: pagination limit zero → 400", async () => {
  const res = await request
    .get("/pos/transactions?limit=0")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
});

test("ux-0: pagination limit > 100 → 400", async () => {
  const res = await request
    .get("/pos/transactions?limit=101")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
});

test("ux-0: pagination offset negative → 400", async () => {
  const res = await request
    .get("/pos/transactions?limit=20&offset=-1")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
});

test("ux-0: pagination valid default limit/offset → 200", async () => {
  const res = await request
    .get("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.meta);
  assert.equal(res.body.meta.limit, 20);
  assert.equal(res.body.meta.offset, 0);
});

test("ux-0: pagination explicit valid values → 200", async () => {
  const res = await request
    .get("/pos/transactions?limit=5&offset=10")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.meta.limit, 5);
  assert.equal(res.body.meta.offset, 10);
});

test("ux-0: invalid UUID → 400", async () => {
  const res = await request
    .get("/pos/transactions/not-a-uuid")
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Invalid id format");
});

test("ux-0: duplicate key → 409 (idempotency key)", async () => {
  const idem = `idem-test-${RUN_ID}-${crypto.randomUUID()}`;
  const payload = {
    items: [{ product_name: "Test", quantity: 1, unit_price: 10000 }],
    payment_method: "cash",
  };

  const first = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idem)
    .send(payload);
  assert.equal(first.status, 201);

  const second = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idem)
    .send(payload);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
});

test("ux-0: cleanup — tutup database pool", async () => {
  await closeDatabase();
});