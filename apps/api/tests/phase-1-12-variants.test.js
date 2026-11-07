"use strict";

/**
 * Task 12: Snapshot harga + varian menu item.
 *
 * Menguji:
 * 1. Price snapshot: Perubahan harga menu item tidak mengubah transaksi lama.
 * 2. CRUD varian: Menambah dan melihat varian menu.
 * 3. Transaksi varian: Memakai harga override dari varian dan menyimpan snapshot.
 * 4. Availability varian: Varian tidak tersedia (is_available=false) ditolak dengan 409.
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

let accessToken = null;
let categoryId = null;
let menuItemId = null;
let pool = null;

async function loginAdmin() {
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", TENANT_A_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "test-device-variant" });
  assert.equal(res.status, 200);
  accessToken = res.body.access_token;
}

test("variants: setup login & create menu item", async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await loginAdmin();

  // Create Category
  const catRes = await request
    .post("/admin/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: `Cat ${Date.now()}` });
  assert.equal(catRes.status, 201);
  categoryId = catRes.body.data.id;

  // Create Menu Item
  const itemRes = await request
    .post("/admin/menu-items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      category_id: categoryId,
      name: "Kopi Susu",
      price: 15000,
      is_available: true,
      sku: `KOPISUS-${Date.now()}`,
    });
  assert.equal(itemRes.status, 201);
  menuItemId = itemRes.body.data.id;
});

test("variants: snapshot harga — perubahan harga menu item tidak mempengaruhi transaksi lama", async () => {
  // 1. Buat transaksi dengan harga asli (15.000)
  const txnRes1 = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      items: [{ menu_item_id: menuItemId, quantity: 2 }],
    });
  assert.equal(txnRes1.status, 201);
  const txn1Id = txnRes1.body.data.id;
  assert.equal(Number(txnRes1.body.data.grand_total), 33300); // (15000 * 2) * 1.11 = 33300

  // 2. Ubah harga menu item dari 15.000 jadi 25.000
  const updateRes = await request
    .patch(`/admin/menu-items/${menuItemId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ price: 25000 });
  assert.equal(updateRes.status, 200);

  // 3. Verifikasi transaksi lama tetap memuat snapshot harga 15.000
  const oldTxn = await request
    .get(`/pos/transactions/${txn1Id}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(oldTxn.status, 200);
  assert.equal(Number(oldTxn.body.data.grand_total), 33300);
  assert.equal(Number(oldTxn.body.data.items[0].unit_price), 15000);
});

test("variants: CRUD varian menu item", async () => {
  // Tambah varian 1: Large (+5000 => 20000 override)
  const var1Res = await request
    .post(`/admin/menu-items/${menuItemId}/variants`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "Large",
      price_override: 20000,
      is_available: true,
    });
  assert.equal(var1Res.status, 201);
  const variant1Id = var1Res.body.data.id;
  assert.equal(var1Res.body.data.name, "Large");
  assert.equal(var1Res.body.data.price_override, 20000);

  // Tambah varian 2: Extra Large (Is Available = false)
  const var2Res = await request
    .post(`/admin/menu-items/${menuItemId}/variants`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "Extra Large",
      price_override: 25000,
      is_available: false,
    });
  assert.equal(var2Res.status, 201);

  // Get varian list
  const listRes = await request
    .get(`/admin/menu-items/${menuItemId}/variants`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.length, 2);
});

test("variants: transaksi dengan varian override", async () => {
  // Ambil varian ID Large
  const listRes = await request
    .get(`/admin/menu-items/${menuItemId}/variants`)
    .set("Authorization", `Bearer ${accessToken}`);
  const largeVariant = listRes.body.data.find((v) => v.name === "Large");

  // Buat transaksi dengan varian Large (price 20000)
  const txnRes = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      items: [{ menu_item_id: menuItemId, variant_id: largeVariant.id, quantity: 1 }],
    });
  assert.equal(txnRes.status, 201);
  assert.equal(txnRes.body.data.items[0].unit_price, 20000);
  assert.equal(txnRes.body.data.items[0].variant_id, largeVariant.id);
  assert.equal(txnRes.body.data.items[0].product_name, "Kopi Susu (Large)");
});

test("variants: varian tidak tersedia ditolak dengan 409", async () => {
  const listRes = await request
    .get(`/admin/menu-items/${menuItemId}/variants`)
    .set("Authorization", `Bearer ${accessToken}`);
  const xlVariant = listRes.body.data.find((v) => v.name === "Extra Large");

  const txnRes = await request
    .post("/pos/transactions")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      payment_method: "cash",
      items: [{ menu_item_id: menuItemId, variant_id: xlVariant.id, quantity: 1 }],
    });
  assert.equal(txnRes.status, 409);
});

test("variants: cleanup", async () => {
  if (pool) await pool.end();
});
