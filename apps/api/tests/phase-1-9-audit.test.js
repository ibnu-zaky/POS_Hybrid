"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

require("dotenv").config();

const app = require("../src/app");
const supertest = require("supertest");
const request = supertest(app);
const { withTenantContext } = require("../src/config/database");

const RUN_ID = Date.now();
const MERCHANT_ID = crypto.randomUUID();
const ADMIN_EMAIL = `audit-admin-${RUN_ID}@dev.local`;
const ADMIN_PASSWORD = "auditpass123";

let accessToken;

async function setup() {
  const { Pool } = require("pg");
  const argon2 = require("argon2");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const passHash = await argon2.hash(ADMIN_PASSWORD);

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [MERCHANT_ID]);
    await client.query(
      `INSERT INTO merchants (id, name, email, subscription_tier, status) VALUES ($1, $2, $3, 'starter', 'active')`,
      [MERCHANT_ID, `Audit Merchant ${RUN_ID}`, ADMIN_EMAIL]
    );
    await client.query(
      `INSERT INTO staff (merchant_id, email, name, role, password_hash) VALUES ($1, $2, $3, 'admin', $4)`,
      [MERCHANT_ID, ADMIN_EMAIL, "Admin Audit", passHash]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }
}

test("audit: setup", async () => {
  await setup();
  const res = await request
    .post("/auth/login")
    .set("X-Tenant-ID", MERCHANT_ID)
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, device_id: "audit-device" });
  assert.equal(res.status, 200);
  accessToken = res.body.access_token;
});

test("audit: event login tercatat di audit_logs dengan merchant_id yang benar", async () => {
  const rows = await withTenantContext(MERCHANT_ID, async (client) => {
    const res = await client.query(
      `SELECT * FROM audit_logs WHERE merchant_id = $1 AND event_type = 'login' ORDER BY occurred_at DESC LIMIT 1`,
      [MERCHANT_ID]
    );
    return res.rows;
  });

  assert.ok(rows.length > 0, "harus ada audit log untuk login");
  assert.equal(rows[0].merchant_id, MERCHANT_ID);
  assert.equal(rows[0].device_id, "audit-device");
  assert.ok(rows[0].occurred_at);
  assert.ok(rows[0].received_at);
});

test("audit: role pos_app gagal melakukan UPDATE pada audit_logs (REVOKE)", async () => {
  let failed = false;
  try {
    await withTenantContext(MERCHANT_ID, async (client) => {
      await client.query(
        `UPDATE audit_logs SET event_type = 'hacked' WHERE merchant_id = $1`,
        [MERCHANT_ID]
      );
    });
  } catch (err) {
    failed = true;
    assert.match(err.message, /permission denied/i);
  }
  assert.ok(failed, "UPDATE harus ditolak oleh REVOKE");
});

test("audit: role pos_app gagal melakukan DELETE pada audit_logs (REVOKE)", async () => {
  let failed = false;
  try {
    await withTenantContext(MERCHANT_ID, async (client) => {
      await client.query(
        `DELETE FROM audit_logs WHERE merchant_id = $1`,
        [MERCHANT_ID]
      );
    });
  } catch (err) {
    failed = true;
    assert.match(err.message, /permission denied/i);
  }
  assert.ok(failed, "DELETE harus ditolak oleh REVOKE");
});
