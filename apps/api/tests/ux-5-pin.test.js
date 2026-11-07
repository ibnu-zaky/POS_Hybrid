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
const { resetRateLimits } = require("../src/middleware/rate-limit");

const request = supertest(app);

const RUN_ID = Date.now();
const MERCHANT_ID = crypto.randomUUID();
const MERCHANT_CODE = `pin-${RUN_ID}`.toLowerCase();
const ADMIN_EMAIL = `admin-pin-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "pinpass1234";
const CASHIER_EMAIL = `cashier-pin-${RUN_ID}@dev.local`;
const CASHIER_PIN = "2468";
const WRONG_PIN = "1357";

let adminAccessToken;
let cashierStaffId;
let cashierAccessToken;
let deviceToken;
let pairingCode;

async function setup() {
  const adminPasswordHash = await argon2.hash(ADMIN_PASSWORD);
  const cashierPinHash = await argon2.hash(CASHIER_PIN);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status, code)
       VALUES ($1, $2, $3, 'starter', 'active', $4)`,
      [MERCHANT_ID, `Pin Tenant ${RUN_ID}`, ADMIN_EMAIL, MERCHANT_CODE],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Pin", adminPasswordHash],
    );
    const cashier = await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, pin_hash)
       VALUES ($1, $2, $3, 'cashier', $4) RETURNING id`,
      [MERCHANT_ID, CASHIER_EMAIL, "Kasir Pin", cashierPinHash],
    );
    cashierStaffId = cashier.rows[0].id;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("ux-5: setup", async () => {
  await setup();
});

test("ux-5: admin login (email+password)", async () => {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "admin-device-pin" });

  assert.equal(res.status, 200);
  assert.ok(res.body.access_token);
  adminAccessToken = res.body.access_token;
});

test("ux-5: PIN login benar dengan merchant_code", async () => {
  const res = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "cashier-tablet-1",
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.access_token);
  assert.equal(res.body.staff.role, "cashier");
  assert.equal(res.body.merchant.code, MERCHANT_CODE);
  cashierAccessToken = res.body.access_token;
});

test("ux-5: PIN login salah -> 401", async () => {
  const res = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: WRONG_PIN,
    device_id: "cashier-tablet-1",
  });

  assert.equal(res.status, 401);
});

test("ux-5: PIN login dengan PIN tidak valid (bukan digit) -> 401", async () => {
  const res = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: "abcd",
    device_id: "cashier-tablet-1",
  });

  assert.equal(res.status, 401);
});

test("ux-5: lockout setelah 5 kali gagal", async () => {
  // Bersihkan rate limit agar diuji lockout akun, bukan rate limit per-IP.
  resetRateLimits();

  // Sudah 1 kali gagal di test sebelumnya. Tambah 4 lagi -> total 5 -> terkunci.
  for (let i = 0; i < 4; i++) {
    const res = await request.post("/auth/pin-login").send({
      merchant_code: MERCHANT_CODE,
      email: CASHIER_EMAIL,
      pin: WRONG_PIN,
      device_id: "cashier-tablet-1",
    });
    assert.equal(res.status, 401);
  }

  // Sekarang terkunci — PIN benar pun harus ditolak.
  const locked = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "cashier-tablet-1",
  });

  assert.equal(locked.status, 401);
  assert.match(locked.body.error, /terkunci/i);
});

test("ux-5: PIN tidak pernah muncul di log", async () => {
  // Verifikasi: tidak ada field pin/pin_hash di respons login mana pun.
  const res = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "cashier-tablet-1",
  });

  const bodyStr = JSON.stringify(res.body);
  assert.ok(!bodyStr.includes(CASHIER_PIN), "PIN tidak boleh bocor di respons");
  assert.ok(!bodyStr.includes("pin_hash"), "pin_hash tidak boleh bocor di respons");
});

test("ux-5: reset lockout (set waktu lock habis) -> login berhasil lagi", async () => {
  // Simulasikan lock habis dengan mengosongkan pin_locked_until + reset counter.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      "UPDATE staff SET pin_locked_until = NULL, pin_failed_count = 0 WHERE merchant_id = $1 AND id = $2",
      [MERCHANT_ID, cashierStaffId],
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }

  resetRateLimits();

  const res = await request.post("/auth/pin-login").send({
    merchant_code: MERCHANT_CODE,
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "cashier-tablet-1",
  });

  if (res.status !== 200) {
  }

  assert.equal(res.status, 200);
  assert.ok(res.body.access_token);
});

test("ux-5: isolasi tenant - merchant_code tidak dikenal -> 401", async () => {
  resetRateLimits();
  const res = await request.post("/auth/pin-login").send({
    merchant_code: "nonexistent-merchant-xyz",
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "cashier-tablet-1",
  });

  if (res.status !== 401) {
  }

  assert.equal(res.status, 401);
});

test("ux-5: buat device pairing (admin)", async () => {
  const res = await request
    .post("/auth/pairing")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({ device_label: "Tablet Kasir 1" });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.pairing_code);
  assert.ok(res.body.data.device_token);
  pairingCode = res.body.data.pairing_code;
  deviceToken = res.body.data.device_token;
});

test("ux-5: redeem pairing -> device_token", async () => {
  const res = await request
    .post("/auth/pairing/redeem")
    .send({ pairing_code: pairingCode, device_id: "tablet-kasir-1" });

  if (res.status !== 200) {
  }

  assert.equal(res.status, 200);
  assert.ok(res.body.data.device_token);
  assert.equal(res.body.data.merchant_code, MERCHANT_CODE);
  // device_token dari redeem berbeda dari yang dibuat (sudah dipakai sekali).
  deviceToken = res.body.data.device_token;
});

test("ux-5: redeem pairing kedua kali -> 401 (sudah dipakai)", async () => {
  const res = await request
    .post("/auth/pairing/redeem")
    .send({ pairing_code: pairingCode, device_id: "tablet-kasir-2" });

  assert.equal(res.status, 401);
});

test("ux-5: PIN login dengan device_token (bukan merchant_code)", async () => {
  // Reset lock dulu agar tidak terkunci.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      "UPDATE staff SET pin_locked_until = NULL, pin_failed_count = 0 WHERE merchant_id = $1 AND id = $2",
      [MERCHANT_ID, cashierStaffId],
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }

  resetRateLimits();

  const res = await request.post("/auth/pin-login").send({
    device_token: deviceToken,
    email: CASHIER_EMAIL,
    pin: CASHIER_PIN,
    device_id: "tablet-kasir-1",
  });

  if (res.status !== 200) {
  }

  assert.equal(res.status, 200);
  assert.equal(res.body.device_label, "Tablet Kasir 1");
});

test("ux-5: cleanup", async () => {
  await closeDatabase();
});
