"use strict";

/**
 * Phase 1.4 Integration Tests — Receipt Printing
 *
 * Menguji:
 * 1. Receipt JSON (digital copy) berisi merchant, cashier, items, totals
 * 2. Receipt text (preview 42 kolom) berisi order number, item, TOTAL
 * 3. Receipt ESC/POS (bytes thermal printer): init, bold, cut, isi baris
 * 4. Format tidak valid → 400
 * 5. Transaksi tidak ada → 404
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

let accessToken = null;
let transactionId = null;
let orderNumber = null;

test("receipt: setup — login + buat transaksi", async () => {
  const login = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });
  assert.equal(login.status, 200);
  accessToken = login.body.access_token || login.body.data?.access_token;
  assert.ok(accessToken, "access token wajib ada");

  const create = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      items: [
        { product_name: `Kopi Susu ${RUN_ID}`, sku: `RCP${RUN_ID}`, quantity: 2, unit_price: 25000 },
        { product_name: `Roti Bakar ${RUN_ID}`, quantity: 1, unit_price: 18000 },
      ],
      payment_method: "cash",
      amount_paid: 100000,
    });

  assert.equal(create.status, 201);
  transactionId = create.body.data.id;
  orderNumber = create.body.data.order_number;
  assert.ok(orderNumber, "order number wajib ada");
});

test("receipt: JSON digital copy lengkap", async () => {
  const res = await request
    .get(`/pos/transactions/${transactionId}/receipt?format=json`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
  const receipt = res.body.data;

  assert.equal(receipt.transaction_id, transactionId);
  assert.equal(receipt.order_number, orderNumber);
  assert.ok(receipt.merchant_name, "nama merchant ada");
  assert.equal(receipt.items.length, 2);
  assert.equal(receipt.items[0].quantity, 2);
  assert.equal(receipt.items[0].line_total, 50000);
  assert.equal(receipt.subtotal, 68000);
  assert.ok(receipt.total > receipt.subtotal, "total termasuk pajak 11%");
  assert.ok(receipt.receipt_url.includes(transactionId), "receipt_url menunjuk transaksi");
  assert.equal(typeof receipt.payment_method, "string");
});

test("receipt: text preview 42 kolom", async () => {
  const res = await request
    .get(`/pos/transactions/${transactionId}/receipt?format=text`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/plain/);

  const text = res.text;
  assert.match(text, new RegExp(orderNumber), "memuat order number");
  assert.match(text, new RegExp(`Kopi Susu ${RUN_ID}`), "memuat nama item");
  assert.match(text, /TOTAL:/);
  assert.match(text, /Payment: cash/);
  assert.match(text, /Thank You!/);
  assert.match(text, /receipts\.pos-hybrid\.com/, "memuat receipt_url");

  const longLines = text.split("\n").filter((line) => line.length > 42);
  assert.equal(longLines.length, 0, `semua baris ≤ 42 kolom: ${JSON.stringify(longLines)}`);
});

test("receipt: ESC/POS bytes thermal printer", async () => {
  const res = await request
    .get(`/pos/transactions/${transactionId}/receipt?format=escpos`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /application\/octet-stream/);

  const body = res.body.toString("binary");
  assert.ok(body.startsWith("\x1b@"), "diawali init printer ESC @");
  assert.ok(body.endsWith("\x1d\x56\x42\x03"), "diakhiri cut paper GS V B");
  assert.ok(body.includes(orderNumber), "memuat order number");
  assert.ok(body.includes("TOTAL:"), "memuat TOTAL");
  assert.ok(body.includes("\x1b\x45\x01"), "memuat bold on untuk TOTAL");
  assert.ok(body.includes("\x1b\x61\x01"), "memuat center align untuk header");
});

test("receipt: format tidak valid → 400", async () => {
  const res = await request
    .get(`/pos/transactions/${transactionId}/receipt?format=pdf`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 400);
  assert.match(res.body.error, /format/);
});

test("receipt: transaksi tidak ada → 404", async () => {
  const res = await request
    .get(`/pos/transactions/00000000-0000-0000-0000-000000000000/receipt`)
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 404);
});

test("receipt: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
