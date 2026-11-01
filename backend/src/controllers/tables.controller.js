"use strict";

const tablesService = require("../services/tables.service");
const { createTableSchema } = require("../schemas/tables.schema");

function tenant(request) {
  return request.auth.merchant_id;
}

async function listTables(request, response, next) {
  try {
    const data = await tablesService.listTables({ merchantId: tenant(request) });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createTable(request, response, next) {
  try {
    const body = createTableSchema.parse(request.body);
    const data = await tablesService.createTable({ merchantId: tenant(request), payload: body });
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function deleteTable(request, response, next) {
  try {
    const data = await tablesService.deleteTable({
      merchantId: tenant(request),
      tableId: request.params.id,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function regenerateToken(request, response, next) {
  try {
    const data = await tablesService.regenerateToken({
      merchantId: tenant(request),
      tableId: request.params.id,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTables,
  createTable,
  deleteTable,
  regenerateToken,
};