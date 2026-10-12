"use strict";

/**
 * Phase 2.2 Integration Tests — HR & Staff Management
 *
 * Menguji:
 * 1. CRUD shift admin (create/list/update/delete) + validasi overlap & unique per hari
 * 2. Clock in/out cashier (auto-link shift hari ini, tolak dobel)
 * 3. Staff performance report dari data transaksi
 * 4. Komisi MVP: hitung harian idempotent + tandai paid
 * 5. Access control: cashier tidak bisa akses /admin/hr/*
 *
 * Merchant khusus diprovision inline supaya aman dari test paralel.
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
const ADMIN_EMAIL = `admin-hr-${RUN_ID}@dev.local`;
const CASHIER_EMAIL = `cashier-hr-${RUN_ID}@dev.local`;
const PASSWORD = "hrpass123";

let adminToken = null;
let cashierToken = null;
let cashierId = null;
let shiftId = null;

function todayString() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function login(email, password) {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email, password, device_id: "hr-device" });
  assert.equal(res.status, 200, `login ${email} harus 200`);
  return res.body.access_token;
}

test("hr: setup — provision merchant + admin + cashier", async () => {
  const passwordHash = await argon2.hash(PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `HR Tenant ${RUN_ID}`, `merchant-hr-${RUN_ID}@dev.local`],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin HR", passwordHash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  adminToken = await login(ADMIN_EMAIL, PASSWORD);

  const staffRes = await request
    .post("/admin/staff")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: CASHIER_EMAIL, name: `Kasir HR ${RUN_ID}`, role: "cashier", password: PASSWORD });
  assert.equal(staffRes.status, 201);
  cashierId = staffRes.body.data.id || staffRes.body.id;
  assert.ok(cashierId, "cashier id ada");

  cashierToken = await login(CASHIER_EMAIL, PASSWORD);
});

test("hr: admin set komisi 5% untuk cashier", async () => {
  const res = await request
    .patch(`/admin/hr/staff/${cashierId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ commission_rate: 0.05, employment_type: "full_time", hire_date: todayString() });

  assert.equal(res.status, 200);
  assert.equal(Number(res.body.data.commission_rate), 0.05);
  assert.equal(res.body.data.employment_type, "full_time");
});

test("hr: create shift hari ini untuk cashier", async () => {
  const res = await request
    .post("/admin/hr/shifts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      staff_id: cashierId,
      shift_date: todayString(),
      start_time: "08:00",
      end_time: "17:00",
    });

  assert.equal(res.status, 201);
  shiftId = res.body.data.id;
  assert.equal(res.body.data.staff_id, cashierId);
  assert.equal(res.body.data.status, "scheduled");
  assert.equal(res.body.data.start_time, "08:00");
});

test("hr: shift dobel per hari → 409 (unique)", async () => {
  const res = await request
    .post("/admin/hr/shifts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      staff_id: cashierId,
      shift_date: todayString(),
      start_time: "18:00",
      end_time: "22:00",
    });

  assert.equal(res.status, 409);
});

test("hr: update shift — validasi waktu & reschedule", async () => {
  const bad = await request
    .patch(`/admin/hr/shifts/${shiftId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ start_time: "18:00", end_time: "17:00" });
  assert.equal(bad.status, 400);

  const ok = await request
    .patch(`/admin/hr/shifts/${shiftId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ start_time: "09:00" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.start_time, "09:00");
});

test("hr: cashier clock-in → auto-link shift, dobel clock-in → 409", async () => {
  const first = await request
    .post("/pos/hr/clock-in")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({});
  assert.equal(first.status, 201);
  assert.equal(first.body.data.staff_id, cashierId);
  assert.ok(first.body.data.clock_in);
  assert.equal(first.body.data.linked_shift, true, "shift hari ini ter-link otomatis");

  const second = await request
    .post("/pos/hr/clock-in")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({});
  assert.equal(second.status, 409);
  assert.match(second.body.error, /clock/i);
});

test("hr: cashier clock-out → durasi tercatat, tanpa clock-in → 409", async () => {
  const out = await request
    .post("/pos/hr/clock-out")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({});
  assert.equal(out.status, 200);
  assert.ok(out.body.data.clock_out);
  assert.equal(typeof out.body.data.duration_minutes, "number");
  assert.ok(out.body.data.duration_minutes >= 0);

  const again = await request
    .post("/pos/hr/clock-out")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({});
  assert.equal(again.status, 409);
});

test("hr: list timesheets admin tercatat", async () => {
  const res = await request
    .get(`/admin/hr/timesheets?staff_id=${cashierId}&from=${todayString()}&to=${todayString()}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  const row = res.body.data.find((t) => t.staff_id === cashierId && t.clock_out);
  assert.ok(row, "timesheet closed ada");
  assert.equal(typeof row.duration_minutes, "number");
});

test("hr: cashier buat transaksi → staff performance mencocokkan", async () => {
  const tx1 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({ items: [{ product_name: `HR Item A ${RUN_ID}`, quantity: 2, unit_price: 25000 }] });
  assert.equal(tx1.status, 201);

  const tx2 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${cashierToken}`)
    .send({ items: [{ product_name: `HR Item B ${RUN_ID}`, quantity: 1, unit_price: 10000 }] });
  assert.equal(tx2.status, 201);

  const expectedSales = Number(tx1.body.data.grand_total) + Number(tx2.body.data.grand_total);

  const res = await request
    .get(`/admin/hr/staff-performance?from=${todayString()}&to=${todayString()}`)
    .set("Authorization", `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  const cashierRow = res.body.data.find((row) => row.staff_id === cashierId);
  assert.ok(cashierRow, "cashier ada di performance report");
  assert.equal(cashierRow.transactions_count, 2);
  assert.ok(Math.abs(cashierRow.total_sales - expectedSales) < 0.01);
});

test("hr: hitung komisi harian — idempotent", async () => {
  const first = await request
    .post(`/admin/hr/commissions/calculate?date=${todayString()}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.length, 1, "hanya cashier dengan rate > 0");

  const commission = first.body.data[0];
  assert.equal(commission.staff_id, cashierId);
  assert.equal(Number(commission.rate), 0.05);
  assert.ok(Number(commission.amount) > 0, "komisi > 0");
  assert.equal(commission.status, "pending");

  const txTotal = Number(commission.base_amount) * 0.05;
  assert.ok(Math.abs(Number(commission.amount) - Math.round(txTotal * 100) / 100) < 0.01);

  const second = await request
    .post(`/admin/hr/commissions/calculate?date=${todayString()}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(second.status, 200);
  assert.equal(second.body.data[0].id, commission.id, "upsert → row sama, tidak dobel");

  const list = await request
    .get(`/admin/hr/commissions?from=${todayString()}&to=${todayString()}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
});

test("hr: tandai komisi paid", async () => {
  const list = await request
    .get(`/admin/hr/commissions?status=pending`)
    .set("Authorization", `Bearer ${adminToken}`);
  const pending = list.body.data.find((row) => row.staff_id === cashierId);
  assert.ok(pending, "ada komisi pending");

  const res = await request
    .patch(`/admin/hr/commissions/${pending.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "paid" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "paid");
});

test("hr: akses control — cashier tidak bisa /admin/hr/*", async () => {
  const shifts = await request
    .get("/admin/hr/shifts")
    .set("Authorization", `Bearer ${cashierToken}`);
  assert.equal(shifts.status, 403);

  const calc = await request
    .post("/admin/hr/commissions/calculate")
    .set("Authorization", `Bearer ${cashierToken}`);
  assert.equal(calc.status, 403);
});

test("hr: delete shift", async () => {
  const res = await request
    .delete(`/admin/hr/shifts/${shiftId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deleted, true);

  const missing = await request
    .delete(`/admin/hr/shifts/${shiftId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(missing.status, 404);
});

test("hr: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
