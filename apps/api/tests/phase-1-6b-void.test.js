"use strict";

/**
 * Task 6: Tes void non-destruktif.
 *
 * Menguji:
 * 1. Void transaksi unpaid/completed → 200, stok kembali (restock) tepat sekali.
 * 2. Void dua kali → idempoten (200), stok tidak dikembalikan ganda.
 * 3. Void transaksi refunded → 409.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");

require("dotenv").config();

const app = require("../src/app");
const { Pool } = require("pg");

const request = supertest(app);

const TENANT_A_ID = "123e4567-e89b-12d3-a456-426614174000";
const ADMIN_EMAIL = "admin@dev.local";
const ADMIN_PASSWORD = "devpassword123";
const RUN_ID = Date.now();

const SKU_V = `INVV${RUN_ID}`;

let accessToken = null;
let transactionId = null;
let pool = null;

async function loginAdmin() {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device-void" });
  assert.equal(res.status, 200);
  accessToken = res.body.access_token;
}

async function getAvailability(token, skus) {
  const res = await request
    .get(`/pos/inventory/availability?sku=${skus.join(",")}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  return res.body.data;
}

async function setTransactionStatus(transactionId, status) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [TENANT_A_ID]);
    await client.query(
      `UPDATE transactions SET status = $1 WHERE id = $2 AND merchant_id = $3`,
      [status, transactionId, TENANT_A_ID],
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

test("void: setup — login + inventory + transaksi completed", async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await loginAdmin();

  const createInv = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku: SKU_V, product_name: "Void Test", quantity: 10, reorder_point: 2, unit_cost: 1000 });
  assert.equal(createInv.status, 201);

  const txnRes = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      amount_paid: 200000,
      items: [{ sku: SKU_V, product_name: "Void Test", quantity: 2, unit_price: 10000, discount_amount: 0 }],
    });
  assert.equal(txnRes.status, 201);
  transactionId = txnRes.body.data.id;

  let data = await getAvailability(accessToken, [SKU_V]);
  assert.equal(data[SKU_V].quantity, 8, "stok berkurang 2 saat create");
});

test("void: void transaksi completed → 200 + stok kembali", async () => {
  const res = await request
    .delete(`/pos/transactions/${transactionId}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.voided, true);
  assert.equal(res.body.data.status, "voided");

  const data = await getAvailability(accessToken, [SKU_V]);
  assert.equal(data[SKU_V].quantity, 10, "stok kembali 8 + 2 = 10");
});

test("void: void kedua kali → idempoten (200), stok tidak berubah", async () => {
  const res = await request
    .delete(`/pos/transactions/${transactionId}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.voided, true);

  const data = await getAvailability(accessToken, [SKU_V]);
  assert.equal(data[SKU_V].quantity, 10, "stok tidak dikembalikan ganda");
});

test("void: void transaksi refunded → 409", async () => {
  const txnRes = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      amount_paid: 50000,
      items: [{ sku: SKU_V, product_name: "Void Refunded", quantity: 1, unit_price: 50000, discount_amount: 0 }],
    });
  assert.equal(txnRes.status, 201);
  const refundedId = txnRes.body.data.id;

  const dataCreate = await getAvailability(accessToken, [SKU_V]);
  assert.equal(dataCreate[SKU_V].quantity, 9, "create mengurangi stok 10 → 9");

  await setTransactionStatus(refundedId, "refunded");

  const res = await request
    .delete(`/pos/transactions/${refundedId}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 409);

  const dataAfter = await getAvailability(accessToken, [SKU_V]);
  assert.equal(dataAfter[SKU_V].quantity, 9, "stok tidak berubah setelah void refunded ditolak (9 = 10 - 1 saat create)");
});

test("void: cleanup", async () => {
  if (pool) await pool.end();
});
