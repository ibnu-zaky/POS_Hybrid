"use strict";

const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const tablesRepository = require("../repositories/tables.repository");
const { ApiError } = require("../utils/api-error");

async function listTables({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    return tablesRepository.listTables(client, merchantId);
  });
}

async function createTable({ merchantId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const token = crypto.randomBytes(24).toString("base64url").replace(/-/g, "").replace(/_/g, "");
    return tablesRepository.createTable(client, merchantId, { number: payload.number, token });
  });
}

async function deleteTable({ merchantId, tableId }) {
  return withTenantContext(merchantId, async (client) => {
    const deleted = await tablesRepository.deleteTable(client, merchantId, tableId);
    if (!deleted) throw new ApiError(404, "Table not found");
    return deleted;
  });
}

async function regenerateToken({ merchantId, tableId }) {
  return withTenantContext(merchantId, async (client) => {
    const updated = await tablesRepository.regenerateToken(client, merchantId, tableId);
    if (!updated) throw new ApiError(404, "Table not found");
    return updated;
  });
}

module.exports = {
  listTables,
  createTable,
  deleteTable,
  regenerateToken,
};