"use strict";

const { Pool } = require("pg");
const env = require("../config/env");
const publicRepository = require("../repositories/public.repository");
const transactionService = require("../services/transaction.service");
const { ApiError } = require("../utils/api-error");

// Pool khusus endpoint publik — terpisah dari pool utama agar tidak
// meninggalkan app.merchant_id di sesi pool aplikasi internal.
const pool = new Pool({ connectionString: env.DATABASE_URL });

async function withPublicTenant(merchantId, fn) {
  const client = await pool.connect();
  try {
    // GUC per-transaksi: setelah COMMIT otomatis hilang (tidak bocor ke sesi berikutnya).
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.merchant_id', $1, true)", [merchantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMenuByToken(token) {
  const client = await pool.connect();
  let merchantId;
  try {
    const tableInfo = await publicRepository.lookupTable(client, token);
    if (!tableInfo) throw new ApiError(404, "Invalid table token");
    merchantId = tableInfo.merchant_id;
  } finally {
    client.release();
  }

  return withPublicTenant(merchantId, async (client) => {
    const data = await publicRepository.getMenu(client, merchantId);
    const tableInfo = await publicRepository.lookupTable(client, token);
    return {
      table_number: tableInfo.number,
      ...data,
    };
  });
}

async function createQrOrder({ token, payload, idempotencyKey }) {
  const client = await pool.connect();
  let tableInfo;
  try {
    tableInfo = await publicRepository.lookupTable(client, token);
    if (!tableInfo) throw new ApiError(404, "Invalid table token");
  } finally {
    client.release();
  }

  const orderPayload = {
    ...payload,
    source: "qr",
    order_type: "dine",
    table_id: tableInfo.table_id,
    idempotency_key: idempotencyKey,
  };

  // transactionService.createTransaction sudah memakai withTenantContext sendiri.
  return transactionService.createTransaction({
    merchantId: tableInfo.merchant_id,
    payload: orderPayload,
  });
}

async function getOrderStatus({ orderId, publicToken }) {
  const client = await pool.connect();
  try {
    // SECURITY DEFINER — akses dibatasi pasangan (id, public_token) yang acak.
    const order = await publicRepository.lookupOrder(client, { orderId, publicToken });
    if (!order) throw new ApiError(404, "Order not found or invalid token");
    return order;
  } finally {
    client.release();
  }
}

module.exports = {
  getMenuByToken,
  createQrOrder,
  getOrderStatus,
};
