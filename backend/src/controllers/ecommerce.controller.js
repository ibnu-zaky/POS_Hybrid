"use strict";

const ecommerceService = require("../services/ecommerce.service");
const {
  createConnectionSchema,
  updateConnectionSchema,
  listOrdersQuerySchema,
  fulfillOrderSchema,
} = require("../schemas/ecommerce.schema");

function tenant(request) { return request.auth.merchant_id; }

// ——— Connections ———

async function listConnections(request, response, next) {
  try {
    const data = await ecommerceService.listConnections({ merchantId: tenant(request) });
    response.json({ data });
  } catch (error) { next(error); }
}

async function createConnection(request, response, next) {
  try {
    const body = createConnectionSchema.parse(request.body);
    const conn = await ecommerceService.createConnection({ merchantId: tenant(request), ...body });
    response.status(201).json(conn);
  } catch (error) { next(error); }
}

async function updateConnection(request, response, next) {
  try {
    const body = updateConnectionSchema.parse(request.body);
    const conn = await ecommerceService.updateConnection({
      merchantId: tenant(request),
      id: request.params.id,
      ...body,
    });
    response.json(conn);
  } catch (error) { next(error); }
}

async function deleteConnection(request, response, next) {
  try {
    const result = await ecommerceService.deleteConnection({
      merchantId: tenant(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

// ——— Sync ———

async function syncOrders(request, response, next) {
  try {
    const result = await ecommerceService.syncOrders({
      merchantId: tenant(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

async function pushInventory(request, response, next) {
  try {
    const { items } = request.body;
    if (!Array.isArray(items) || items.length === 0) {
      return response.status(400).json({ error: "items harus berupa array dan tidak kosong" });
    }
    const result = await ecommerceService.pushInventory({
      merchantId: tenant(request),
      id: request.params.id,
      items,
    });
    response.json(result);
  } catch (error) { next(error); }
}

// ——— Orders ———

async function listOrders(request, response, next) {
  try {
    const query = listOrdersQuerySchema.parse(request.query);
    const data = await ecommerceService.listOrders({ merchantId: tenant(request), ...query });
    response.json({ data });
  } catch (error) { next(error); }
}

async function getOrder(request, response, next) {
  try {
    const order = await ecommerceService.getOrderDetail({
      merchantId: tenant(request),
      id: request.params.id,
    });
    response.json(order);
  } catch (error) { next(error); }
}

async function fulfillOrder(request, response, next) {
  try {
    const body = fulfillOrderSchema.parse(request.body);
    const updated = await ecommerceService.fulfillOrder({
      merchantId: tenant(request),
      id: request.params.id,
      ...body,
    });
    response.json(updated);
  } catch (error) { next(error); }
}

module.exports = {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  syncOrders,
  pushInventory,
  listOrders,
  getOrder,
  fulfillOrder,
};
