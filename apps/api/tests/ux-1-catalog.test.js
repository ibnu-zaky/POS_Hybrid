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

const request = supertest(app);

const RUN_ID = Date.now();
const MERCHANT_A_ID = crypto.randomUUID();
const MERCHANT_B_ID = crypto.randomUUID();
const ADMIN_A_EMAIL = `admin-a-${RUN_ID}@dev.local`;
const ADMIN_B_EMAIL = `admin-b-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "catalogpass123";

let tokenA = null;
let tokenB = null;

async function setupMerchant(merchantId, email) {
  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [merchantId]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status)
       VALUES ($1, $2, $3, 'starter', 'active')`,
      [merchantId, `Tenant ${merchantId}`, email],
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [merchantId, email, "Admin", passwordHash],
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
    .set("X-Tenant-ID", merchantId)
    .send({ email, password: ADMIN_PASSWORD, device_id: "test-device" });
  return login.body.access_token;
}

test("ux-1: setup tenants", async () => {
  tokenA = await setupMerchant(MERCHANT_A_ID, ADMIN_A_EMAIL);
  tokenB = await setupMerchant(MERCHANT_B_ID, ADMIN_B_EMAIL);
});

let categoryId = null;

test("ux-1: create category & isolation", async () => {
  const resA = await request
    .post("/admin/categories")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Minuman", icon: "coffee", sort_order: 1 });
  assert.equal(resA.status, 201);
  assert.equal(resA.body.data.name, "Minuman");
  categoryId = resA.body.data.id;

  // Merchant B should not see Merchant A's category
  const resB = await request
    .get("/admin/categories")
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(resB.status, 200);
  assert.equal(resB.body.data.length, 0);
});

test("ux-1: duplicate category name case-insensitive rejected", async () => {
  const res = await request
    .post("/admin/categories")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "minuman" });
  assert.equal(res.status, 409);
});

let menuItemId = null;

test("ux-1: create menu item", async () => {
  const res = await request
    .post("/admin/menu-items")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      category_id: categoryId,
      name: "Es Kopi Susu",
      price: 18000,
      is_available: true,
      track_stock: false,
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.name, "Es Kopi Susu");
  assert.equal(res.body.data.price, 18000);
  menuItemId = res.body.data.id;
});

test("ux-1: menu item negative price rejected", async () => {
  const res = await request
    .post("/admin/menu-items")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      category_id: categoryId,
      name: "Invalid Item",
      price: -5000,
    });
  assert.equal(res.status, 400);
});

test("ux-1: delete category with items returns 409", async () => {
  const res = await request
    .delete(`/admin/categories/${categoryId}`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(res.status, 409);
});

test("ux-1: toggle menu item availability via pos route", async () => {
  const res = await request
    .patch(`/pos/menu-items/${menuItemId}/availability`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ is_available: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.is_available, false);
});

let tableId = null;
let originalToken = null;

test("ux-1: create table & token generation", async () => {
  const res = await request
    .post("/admin/tables")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ number: 1 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.number, 1);
  assert.ok(res.body.data.token.length >= 24);
  tableId = res.body.data.id;
  originalToken = res.body.data.token;
});

test("ux-1: regenerate table token invalidates old token", async () => {
  const res = await request
    .post(`/admin/tables/${tableId}/regenerate-token`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(res.status, 200);
  assert.notEqual(res.body.data.token, originalToken);

  // Test the lookup function directly
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const oldLookup = await client.query("SELECT * FROM public.lookup_table_by_token($1)", [originalToken]);
    assert.equal(oldLookup.rows.length, 0);

    const newLookup = await client.query("SELECT * FROM public.lookup_table_by_token($1)", [res.body.data.token]);
    assert.equal(newLookup.rows.length, 1);
    assert.equal(newLookup.rows[0].table_id, tableId);
    assert.equal(newLookup.rows[0].merchant_id, MERCHANT_A_ID);
  } finally {
    client.release();
    await pool.end();
  }
});

test("ux-1: cleanup", async () => {
  await closeDatabase();
});