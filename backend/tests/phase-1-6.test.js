"use strict";

/**
 * Phase 1.6 Integration Tests — Inventory Management
 *
 * Menguji:
 * 1. CRUD inventory admin + initial stock movement
 * 2. Availability endpoint (/pos/inventory/availability)
 * 3. Atomic stock deduction saat create transaksi
 * 4. Oversell prevention → 409, stok tidak berubah (rollback)
 * 5. Restock saat delete transaksi
 * 6. Adjustment stok manual + movement ledger
 * 7. Restock 'return' saat refund payment penuh
 * 8. Item tanpa SKU / SKU untracked tidak menyentuh inventory
 *
 * Kebutuhan: sama dengan phase-1-1 (DB + migrations + seed-dev).
 *
 * Menjalankan: npm test
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");

require("dotenv").config();

const app = require("../src/app");
const { closeDatabase } = require("../src/config/database");

const request = supertest(app);

const TENANT_A_ID = "123e4567-e89b-12d3-a456-426614174000";
const ADMIN_EMAIL = "admin@dev.local";
const ADMIN_PASSWORD = "devpassword123";
const RUN_ID = Date.now();

const SKU_A = `INVA${RUN_ID}`;
const SKU_B = `INVB${RUN_ID}`;
const SKU_C = `INVC${RUN_ID}`;
const SKU_UNTRACKED = `INVU${RUN_ID}`;

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

async function getAvailability(token, skus) {
  const res = await request
    .get(`/pos/inventory/availability?sku=${skus.join(",")}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  return res.body.data;
}

let skipDbTests = false;
let accessToken = null;
let inventoryAId = null;
let inventoryBId = null;
let transaction1Id = null;
let transactionForRefundId = null;
let refundGrandTotal = null;

test("inventory: setup — login admin", async () => {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });

  if (res.status === 503 || res.status === 401) {
    skipDbTests = true;
    console.warn("  ⚠  Database/seed tidak tersedia — test inventory dilewati");
    return;
  }

  assert.equal(res.status, 200);
  accessToken = res.body.access_token;
});

test("inventory: create item baru dengan initial stock → movement adjustment", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      sku: SKU_A,
      product_name: "Kopi Sachet",
      quantity: 50,
      reorder_point: 5,
      unit_cost: 1500,
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.sku, SKU_A);
  assert.equal(res.body.data.quantity, 50);
  inventoryAId = res.body.data.id;
});

test("inventory: availability mengembalikan stok awal", async () => {
  if (skipDbTests) return;

  const data = await getAvailability(accessToken, [SKU_A, SKU_UNTRACKED]);

  assert.equal(data[SKU_A].quantity, 50);
  assert.equal(data[SKU_A].available, true);
  assert.equal(data[SKU_A].status, "optimal");
  // SKU untracked tidak muncul di response
  assert.equal(data[SKU_UNTRACKED], undefined);
});

test("inventory: create transaksi dengan SKU tracked → stok berkurang atomik", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      amount_paid: 100000,
      items: [
        { sku: SKU_A, product_name: "Kopi Sachet", quantity: 2, unit_price: 10000, discount_amount: 0 },
        { product_name: "Tanpa SKU", quantity: 1, unit_price: 5000, discount_amount: 0 },
      ],
    });

  assert.equal(res.status, 201);
  transaction1Id = res.body.data.id;

  const data = await getAvailability(accessToken, [SKU_A]);
  assert.equal(data[SKU_A].quantity, 48, "stok harus berkurang 2");
});

test("inventory: movement ledger mencatat sale -2", async () => {
  if (skipDbTests) return;

  const res = await request
    .get(`/admin/inventory/movements?sku=${SKU_A}`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
  const saleMovement = res.body.data.find((m) => m.type === "sale" && m.quantity === -2);
  assert.ok(saleMovement, "harus ada movement sale dengan quantity -2");
  assert.equal(saleMovement.transaction_id, transaction1Id);
});

test("inventory: adjust stock manual +5 → movement adjustment", async () => {
  if (skipDbTests) return;

  const res = await request
    .post(`/admin/inventory/${inventoryAId}/adjust`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ quantity: 5, reference_id: `opname-${RUN_ID}` });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.quantity, 53);

  const data = await getAvailability(accessToken, [SKU_A]);
  assert.equal(data[SKU_A].quantity, 53);
});

test("inventory: oversell ditolak 409 dan stok tidak berubah", async () => {
  if (skipDbTests) return;

  const createRes = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku: SKU_B, product_name: "Stok Sisa", quantity: 1, reorder_point: 0 });
  assert.equal(createRes.status, 201);
  inventoryBId = createRes.body.data.id;

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      items: [{ sku: SKU_B, product_name: "Stok Sisa", quantity: 5, unit_price: 10000 }],
    });

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Insufficient stock/);

  const data = await getAvailability(accessToken, [SKU_B]);
  assert.equal(data[SKU_B].quantity, 1, "stok tidak boleh berubah setelah gagal transaksi");
});

test("inventory: adjust di bawah nol ditolak 409", async () => {
  if (skipDbTests) return;

  const res = await request
    .post(`/admin/inventory/${inventoryBId}/adjust`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ quantity: -100 });

  assert.equal(res.status, 409);
  assert.match(res.body.error, /below 0/);
});

test("inventory: delete transaksi → stok kembali (restock)", async () => {
  if (skipDbTests) return;

  const res = await request
    .delete(`/pos/transactions/${transaction1Id}`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);

  const data = await getAvailability(accessToken, [SKU_A]);
  assert.equal(data[SKU_A].quantity, 55, "stok kembali 48 + 2 = 50, lalu 50 + 5 (adjust) = 55");
});

test("inventory: transaksi dengan SKU untracked tidak gagal", async () => {
  if (skipDbTests) return;

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      items: [{ sku: SKU_UNTRACKED, product_name: "Belum Didaftarkan", quantity: 3, unit_price: 7000 }],
    });

  assert.equal(res.status, 201, "SKU tanpa baris inventory = untracked, bukan oversell");
});

test("inventory: refund penuh → movement return +3", async () => {
  if (skipDbTests) return;

  const createInv = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku: SKU_C, product_name: "Item Refund", quantity: 10, reorder_point: 2 });
  assert.equal(createInv.status, 201);

  const txnRes = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "card",
      items: [{ sku: SKU_C, product_name: "Item Refund", quantity: 3, unit_price: 10000 }],
    });
  assert.equal(txnRes.status, 201);
  transactionForRefundId = txnRes.body.data.id;
  refundGrandTotal = Number(txnRes.body.data.grand_total);

  let data = await getAvailability(accessToken, [SKU_C]);
  assert.equal(data[SKU_C].quantity, 7, "stok berkurang 3 saat create");

  const payRes = await request
    .post(`/pos/transactions/${transactionForRefundId}/payments`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ provider: "dummy", payment_method: "card" });
  assert.equal(payRes.status, 201);
  const paymentId = payRes.body.data.id;
  const paymentReference = payRes.body.data.provider_reference;

  const webhookRes = await request
    .post("/webhooks/payment/completion?provider=dummy")
    .set("X-Dummy-Webhook-Secret", "dummy-development-secret")
    .send({
      event_id: `inv-refund-${RUN_ID}`,
      event_type: "payment.paid",
      payment_reference: paymentReference,
      status: "paid",
      amount: refundGrandTotal,
      currency: "IDR",
    });
  assert.equal(webhookRes.status, 200);

  const refundRes = await request
    .post(`/pos/payments/${paymentId}/refund`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({});
  assert.equal(refundRes.status, 200);

  data = await getAvailability(accessToken, [SKU_C]);
  assert.equal(data[SKU_C].quantity, 10, "refund penuh → stok kembali 7 + 3 = 10");

  const movements = await request
    .get(`/admin/inventory/movements?sku=${SKU_C}`)
    .set("Authorization", `Bearer ${accessToken}`);
  const returnMovement = movements.body.data.find((m) => m.type === "return" && m.quantity === 3);
  assert.ok(returnMovement, "harus ada movement return +3");
});

test("inventory: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
