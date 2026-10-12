"use strict";

/**
 * Phase 1.5 Integration Tests — Offline Transaction Support (Idempotency)
 *
 * Menguji:
 * 1. POST /pos/transactions dengan header Idempotency-Key → 201, key tersimpan
 * 2. Retry/replay key yang sama → 200, transaksi sama, TIDAK dobel, stok tidak dipotong dua kali
 * 3. idempotency_key via body payload juga bekerja
 * 4. Key berbeda → transaksi baru
 * 5. Key terlalu panjang → 400 (validasi zod)
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

const KEY_HEADER = `offline-hdr-${RUN_ID}`;
const KEY_BODY = `offline-body-${RUN_ID}`;
const KEY_DIFF = `offline-diff-${RUN_ID}`;
const SKU = `IDEM${RUN_ID}`;

let accessToken = null;
let inventoryId = null;

async function getQuantity(sku) {
  const res = await request
    .get(`/pos/inventory/availability?sku=${sku}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(res.status, 200);
  return res.body.data[sku]?.quantity ?? 0;
}

test("idempotency: setup — login + inventory 10 unit", async () => {
  const login = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device" });
  assert.equal(login.status, 200);
  accessToken = login.body.access_token;

  const inv = await request
    .post("/admin/inventory")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ sku: SKU, product_name: `Produk Idem ${RUN_ID}`, quantity: 10, reorder_point: 2 });
  assert.equal(inv.status, 201);
  inventoryId = inv.body.data.id;

  assert.equal(await getQuantity(SKU), 10);
});

test("idempotency: create pertama dengan header key → 201 + stok terpotong", async () => {
  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", KEY_HEADER)
    .send({
      items: [{ product_name: `Produk Idem ${RUN_ID}`, sku: SKU, quantity: 3, unit_price: 10000 }],
      payment_method: "cash",
    });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.id);
  assert.equal(res.body.data.idempotency_key, KEY_HEADER);
  assert.equal(res.body.replayed, undefined, "create pertama bukan replay");
  assert.equal(await getQuantity(SKU), 7, "stok dipotong sekali (10 - 3)");
});

test("idempotency: retry key sama → 200, transaksi sama, stok tidak dipotong lagi", async () => {
  const before = await request
    .get("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .then((r) => r.body.meta.total);

  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", KEY_HEADER)
    .send({
      items: [{ product_name: `Produk Idem ${RUN_ID}`, sku: SKU, quantity: 3, unit_price: 10000 }],
      payment_method: "cash",
    });

  assert.equal(res.status, 200, "replay → 200");
  assert.equal(res.body.replayed, true);
  assert.ok(res.body.data.id, "data transaksi ikut dikembalikan");
  assert.equal(res.body.data.items.length, 1, "items ikut dikembalikan");

  const after = await request
    .get("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .then((r) => r.body.meta.total);

  assert.equal(after, before, "total transaksi tidak bertambah (tidak dobel)");
  assert.equal(await getQuantity(SKU), 7, "stok tidak dipotong dua kali");
});

test("idempotency: key via body payload juga bekerja", async () => {
  const first = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      idempotency_key: KEY_BODY,
      items: [{ product_name: `Produk Idem ${RUN_ID}`, sku: SKU, quantity: 2, unit_price: 15000 }],
    });
  assert.equal(first.status, 201);

  const replay = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      idempotency_key: KEY_BODY,
      items: [{ product_name: `Produk Idem ${RUN_ID}`, sku: SKU, quantity: 2, unit_price: 15000 }],
    });

  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.data.id, first.body.data.id);
  assert.equal(await getQuantity(SKU), 5, "stok 7 - 2 (sekali saja)");
});

test("idempotency: key berbeda → transaksi baru", async () => {
  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", KEY_DIFF)
    .send({
      items: [{ product_name: `Produk Idem ${RUN_ID}`, sku: SKU, quantity: 1, unit_price: 5000 }],
    });

  assert.equal(res.status, 201);
  assert.notEqual(res.body.data.idempotency_key, KEY_HEADER);
  assert.notEqual(res.body.data.idempotency_key, KEY_BODY);
  assert.equal(await getQuantity(SKU), 4);
});

test("idempotency: key terlalu panjang → 400", async () => {
  const res = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", "x".repeat(101))
    .send({
      items: [{ product_name: "Item", quantity: 1, unit_price: 1000 }],
    });

  assert.equal(res.status, 400);
});

test("idempotency: cleanup — tutup database pool", async () => {
  await closeDatabase();
});
