"use strict";

/**
 * Task 13: OpenAPI 3.1 generator test
 *
 * Menguji:
 * 1. GET /openapi.json return 200, openapi 3.1.0 spec
 * 2. Memuat route utama: /pos/transactions dan /admin/inventory
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const supertest = require("supertest");

require("dotenv").config();

const app = require("../src/app");
const request = supertest(app);

test("openapi: GET /openapi.json returns 200 and valid OpenAPI 3.1 spec", async () => {
  const res = await request.get("/openapi.json");
  assert.equal(res.status, 200);
  assert.equal(res.body.openapi, "3.1.0");
  assert.equal(typeof res.body.info, "object");
  assert.equal(res.body.info.title, "POS Hybrid API");

  // Check main paths exist in spec
  assert.ok(res.body.paths["/pos/transactions"], "contains /pos/transactions");
  assert.ok(res.body.paths["/admin/inventory"], "contains /admin/inventory");
  assert.ok(res.body.paths["/auth/login"], "contains /auth/login");
});
