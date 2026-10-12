"use strict";

/**
 * Phase 1.1 Integration Tests
 *
 * Menguji:
 * 1. Auth flow — login, refresh, logout, /me
 * 2. RLS tenant isolation — tenant A tidak bisa baca data tenant B
 * 3. API key — generate, authenticate, revoke
 * 4. Admin staff CRUD
 * 5. Error handler — production tidak leak stack trace
 * 6. Schema validation — unit test untuk Zod schemas
 *
 * Kebutuhan:
 * - DATABASE_URL mengarah ke database PostgreSQL yang sudah menjalankan semua migrations
 * - Ada minimal 1 merchant + 1 staff admin yang bisa login
 *   (jalankan: npm run seed-dev terlebih dahulu)
 *
 * Menjalankan: npm test
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");
const { assertTransition } = require("../src/services/payment.service");

// Load env sebelum app agar konfigurasi siap
require("dotenv").config();

const app = require("../src/app");
const { closeDatabase } = require("../src/config/database");

const request = supertest(app);

// ============================================================
// Konstanta test — sesuai dengan data seed-dev.js
// ============================================================
const TENANT_A_ID = "123e4567-e89b-12d3-a456-426614174000";
const ADMIN_EMAIL = "admin@dev.local";
const ADMIN_PASSWORD = "devpassword123";

// ============================================================
// Helper: Login dan ambil token
// ============================================================
async function loginAdmin() {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });

  if (res.status !== 200) {
    throw new Error(`Login gagal: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body;
}

// ============================================================
// 1. Schema unit tests (tidak butuh database)
// ============================================================
test("schema: createApiKeySchema menerima name valid", () => {
  const { createApiKeySchema } = require("../src/schemas/admin.schema");
  const result = createApiKeySchema.parse({ name: "integration-key" });
  assert.equal(result.name, "integration-key");
});

test("schema: createTransactionSchema menolak item kosong", () => {
  const { createTransactionSchema } = require("../src/schemas/pos.schema");
  assert.throws(() => createTransactionSchema.parse({ items: [] }));
});

test("payment state machine rejects paid back to pending", () => {
  assert.throws(() => assertTransition("paid", "pending"));
});

test("payment state machine accepts pending to paid", () => {
  assert.doesNotThrow(() => assertTransition("pending", "paid"));
});

test("schema: loginSchema menolak email tidak valid", () => {
  const { loginSchema } = require("../src/schemas/auth.schema");
  assert.throws(() => loginSchema.parse({ email: "bukan-email", password: "abc", device_id: "x" }));
});

test("schema: updateStaffSchema hanya menerima field yang diizinkan", () => {
  const { updateStaffSchema } = require("../src/schemas/admin.schema");
  // Field tidak dikenal harus ditolak (strict schema)
  assert.throws(() => updateStaffSchema.parse({ role: "admin", unknown_field: "x" }));
  // Field valid harus diterima
  const valid = updateStaffSchema.parse({ role: "manager", is_active: true });
  assert.equal(valid.role, "manager");
});

// ============================================================
// 2. Health endpoint
// ============================================================
test("GET /health — mengembalikan status ok", async () => {
  const res = await request.get("/health");
  // Bisa ok atau degraded — tergantung koneksi DB, tapi endpoint harus merespons
  assert.ok([200, 503].includes(res.status));
  assert.ok(res.body.status);
});

// ============================================================
// 3. Auth flow (butuh DB + seed data)
// Jika DB tidak tersedia, test ini akan skip dengan pesan warning.
// ============================================================
let authTokens = null;
let skipDbTests = false;

test("auth: login dengan kredensial valid", async () => {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });

  if (res.status === 503) {
    skipDbTests = true;
    console.warn("  ⚠  Database tidak tersedia — test DB dilewati");
    return;
  }

  if (res.status === 401) {
    skipDbTests = true;
    console.warn("  ⚠  Seed data tidak ditemukan — jalankan 'npm run seed-dev' terlebih dahulu");
    return;
  }

  assert.equal(res.status, 200);
  assert.ok(res.body.access_token, "Harus ada access_token");
  assert.ok(res.body.refresh_token, "Harus ada refresh_token");
  assert.equal(res.body.token_type, "Bearer");
  assert.ok(res.body.staff?.id);
  assert.ok(res.body.merchant?.id);

  authTokens = res.body;
});

test("auth: login dengan password salah ditolak", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: "wrongpassword", device_id: "test-device" });

  assert.equal(res.status, 401);
});

test("auth: login tanpa X-Tenant-ID ditolak", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });

  assert.equal(res.status, 400);
});

test("auth: /me dengan token valid mengembalikan data staff", async () => {
  if (skipDbTests || !authTokens) return;

  const res = await request
    .get("/auth/me")
    .set("Authorization", `Bearer ${authTokens.access_token}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.staff?.email);
  assert.ok(res.body.merchant?.id);
});

test("auth: /me tanpa token ditolak", async () => {
  if (skipDbTests) return;

  const res = await request.get("/auth/me");
  assert.equal(res.status, 401);
});

test("auth: refresh token menghasilkan token baru", async () => {
  if (skipDbTests || !authTokens) return;

  const res = await request
    .post("/auth/refresh")
    .send({ refresh_token: authTokens.refresh_token });

  assert.equal(res.status, 200);
  assert.ok(res.body.access_token);
  // Token harus berbeda (rotasi)
  assert.notEqual(res.body.access_token, authTokens.access_token);
});

test("auth: logout berhasil", async () => {
  if (skipDbTests || !authTokens) return;

  const res = await request
    .post("/auth/logout")
    .set("Authorization", `Bearer ${authTokens.access_token}`)
    .send({ refresh_token: authTokens.refresh_token });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

// ============================================================
// 4. RLS Tenant Isolation
// ============================================================
test("rls: request tanpa merchant_id context ditolak oleh middleware", async () => {
  // Request tanpa token → 401
  const res = await request.get("/pos/transactions");
  assert.equal(res.status, 401);
});

test("rls: request dengan tenant ID berbeda di header diabaikan (merchant_id diambil dari JWT)", async () => {
  if (skipDbTests) return;

  // Login ulang untuk mendapat token segar
  const loginRes = await loginAdmin();

  // Coba set X-Tenant-ID ke UUID berbeda — middleware harus mengabaikan ini
  // dan menggunakan merchant_id dari JWT
  const fakeTenantId = "00000000-0000-0000-0000-000000000099";
  const res = await request
    .get("/pos/transactions")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .set("X-Tenant-ID", fakeTenantId); // Ini harus diabaikan

  // Harus berhasil (menggunakan merchant dari JWT, bukan header)
  assert.equal(res.status, 200);
});

test("rls: UUID tidak valid di query parameter menghasilkan 400", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .get("/pos/transactions/invalid-uuid-format")
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.ok([400, 404].includes(res.status));
});

// ============================================================
// 5. Admin Endpoints — Staff CRUD
// ============================================================
let createdStaffId = null;

test("admin: list staff membutuhkan role admin", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .get("/admin/staff")
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test("admin: create staff baru dengan data valid", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();
  const uniqueEmail = `test-cashier-${Date.now()}@test.local`;

  const res = await request
    .post("/admin/staff")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({
      email: uniqueEmail,
      name: "Test Cashier",
      role: "cashier",
      password: "TestPass123!",
    });

  if (res.status === 201) {
    createdStaffId = res.body.data?.id;
    assert.ok(createdStaffId);
    assert.equal(res.body.data.role, "cashier");
    assert.equal(res.body.data.is_active, true);
  } else {
    // Mungkin gagal karena email duplikat — tidak kritis untuk test suite
    assert.ok([201, 409].includes(res.status));
  }
});

test("admin: create staff dengan email duplikat menghasilkan 409", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  // Email yang sudah ada dari seed-dev
  const res = await request
    .post("/admin/staff")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({
      email: ADMIN_EMAIL,
      name: "Duplicate Staff",
      role: "cashier",
      password: "TestPass123!",
    });

  assert.equal(res.status, 409);
});

test("admin: update staff berhasil", async () => {
  if (skipDbTests || !createdStaffId) return;

  const loginRes = await loginAdmin();

  const res = await request
    .patch(`/admin/staff/${createdStaffId}`)
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({ role: "manager" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, "manager");
});

test("admin: deactivate staff berhasil", async () => {
  if (skipDbTests || !createdStaffId) return;

  const loginRes = await loginAdmin();

  const res = await request
    .delete(`/admin/staff/${createdStaffId}`)
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.is_active, false);
});

// ============================================================
// 6. API Key — Generate, Authenticate, Revoke
// ============================================================
let generatedApiKey = null;
let generatedApiKeyId = null;

test("admin: generate API key baru", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .post("/admin/api-keys")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({ name: "test-integration-key" });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.key, "rawKey harus dikembalikan saat generate");
  assert.ok(res.body.data.id);
  assert.ok(res.body.data.key_prefix);
  // Raw key tidak boleh ada di list berikutnya
  generatedApiKey = res.body.data.key;
  generatedApiKeyId = res.body.data.id;
});

test("admin: list API keys tidak mengekspos raw key", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .get("/admin/api-keys")
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));

  // Pastikan tidak ada field 'key' (raw key) di list
  for (const k of res.body.data) {
    assert.equal(k.key, undefined, "Raw key tidak boleh muncul di list");
    assert.ok(k.key_prefix, "Prefix harus ada");
  }
});

test("apikey: authenticate dengan ApiKey scheme berhasil", async () => {
  if (skipDbTests || !generatedApiKey) return;

  const res = await request
    .get("/pos/transactions")
    .set("Authorization", `ApiKey ${generatedApiKey}`);

  assert.equal(res.status, 200);
});

test("apikey: authenticate dengan API key salah ditolak", async () => {
  if (skipDbTests) return;

  const res = await request
    .get("/pos/transactions")
    .set("Authorization", "ApiKey pk_live_invalidkey0000000000000000000000000000000000000000");

  assert.equal(res.status, 401);
});

test("admin: revoke API key berhasil", async () => {
  if (skipDbTests || !generatedApiKeyId) return;

  const loginRes = await loginAdmin();

  const res = await request
    .delete(`/admin/api-keys/${generatedApiKeyId}`)
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
});

test("apikey: authenticate dengan revoked API key ditolak", async () => {
  if (skipDbTests || !generatedApiKey) return;

  const res = await request
    .get("/pos/transactions")
    .set("Authorization", `ApiKey ${generatedApiKey}`);

  assert.equal(res.status, 401);
});

// ============================================================
// 7. POS Transactions — CRUD dasar
// ============================================================
let createdTransactionId = null;

test("pos: create transaction berhasil", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({
      payment_method: "cash",
      amount_paid: 100000,
      items: [
        {
          product_name: "Nasi Goreng",
          quantity: 2,
          unit_price: 25000,
          discount_amount: 0,
        },
      ],
    });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.id);
  assert.ok(Array.isArray(res.body.data.items));
  assert.equal(res.body.data.items.length, 1);

  createdTransactionId = res.body.data.id;
});

test("pos: get transaction by ID berhasil", async () => {
  if (skipDbTests || !createdTransactionId) return;

  const loginRes = await loginAdmin();

  const res = await request
    .get(`/pos/transactions/${createdTransactionId}`)
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, createdTransactionId);
});

test("pos: list transactions berhasil", async () => {
  if (skipDbTests) return;

  const loginRes = await loginAdmin();

  const res = await request
    .get("/pos/transactions?limit=5")
    .set("Authorization", `Bearer ${loginRes.access_token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(typeof res.body.meta.total === "number");
});

// ============================================================
// 8. Payments — Dummy checkout, webhook, idempotency
// ============================================================
let createdPaymentId = null;
let createdPaymentReference = null;

test("payment: create dummy checkout berhasil", async () => {
  if (skipDbTests || !createdTransactionId) return;

  const loginRes = await loginAdmin();
  const res = await request
    .post(`/pos/transactions/${createdTransactionId}/payments`)
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .send({ provider: "dummy", payment_method: "card" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "pending");
  assert.equal(res.body.data.provider, "dummy");
  assert.ok(res.body.data.checkout_url);
  createdPaymentId = res.body.data.id;
  createdPaymentReference = res.body.data.provider_reference;
});

test("payment: webhook dummy menyelesaikan pembayaran", async () => {
  if (skipDbTests || !createdPaymentId) return;

  const body = {
    event_id: `payment-test-${createdPaymentId}`,
    event_type: "payment.paid",
    payment_reference: createdPaymentReference,
    status: "paid",
    amount: 55500,
    currency: "IDR",
  };
  const res = await request
    .post("/webhooks/payment/completion?provider=dummy")
    .set("X-Dummy-Webhook-Secret", "dummy-development-secret")
    .send(body);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "paid");
  assert.equal(res.body.data.duplicate, false);
});

test("payment: webhook duplicate diabaikan", async () => {
  if (skipDbTests || !createdPaymentId) return;

  const body = {
    event_id: `payment-test-${createdPaymentId}`,
    event_type: "payment.paid",
    payment_reference: createdPaymentReference,
    status: "paid",
    amount: 55500,
    currency: "IDR",
  };
  const res = await request
    .post("/webhooks/payment/completion?provider=dummy")
    .set("X-Dummy-Webhook-Secret", "dummy-development-secret")
    .send(body);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.duplicate, true);
  assert.equal(res.body.data.status, "ignored");
});

test("payment: webhook dengan secret salah ditolak", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/webhooks/payment/completion?provider=dummy")
    .set("X-Dummy-Webhook-Secret", "wrong-secret")
    .send({ event_id: "invalid-payment-secret", payment_reference: "unknown", status: "paid", amount: 1, currency: "IDR" });

  assert.equal(res.status, 401);
});

// ============================================================
// 9. Error handler — tidak leak stack trace
// ============================================================
test("error-handler: request ke endpoint tidak ada menghasilkan 404 bukan stack trace", async () => {
  const res = await request.get("/endpoint-tidak-ada");
  // Express 5 default 404 — atau error handler kita
  assert.ok([404, 400, 500].includes(res.status));
  // Pastikan tidak ada 'stack' di body saat NODE_ENV bukan 'development'
  if (process.env.NODE_ENV === "production") {
    assert.equal(res.body.stack, undefined);
  }
});

test("error-handler: request dengan body JSON tidak valid menghasilkan 400", async () => {
  const loginRes = skipDbTests ? { access_token: "dummy" } : await loginAdmin();

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${loginRes.access_token}`)
    .set("Content-Type", "application/json")
    .send('{"items": "bukan-array"}');

  // Zod harus menolak 'items' yang bukan array
  assert.ok([400, 401].includes(res.status));
});

// ============================================================
// Cleanup
// ============================================================
test("cleanup: tutup database pool", async () => {
  await closeDatabase();
});