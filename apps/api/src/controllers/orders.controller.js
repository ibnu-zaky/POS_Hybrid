"use strict";

const transactionService = require("../services/transaction.service");
const { ordersQuerySchema, updateFulfillmentStatusSchema, manualPaymentSchema } = require("../schemas/phase-e-orders.schema");

async function listOrders(request, response, next) {
  try {
    const query = ordersQuerySchema.parse(request.query);
    const merchantId = request.auth.merchant_id;

    const result = await transactionService.listOrders({
      merchantId,
      filters: query.filters,
      status: query.status,
      source: query.source,
      table_id: query.table_id,
      limit: query.limit,
      offset: query.offset,
      since: query.since,
    });

    response.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
}

async function updateFulfillmentStatus(request, response, next) {
  try {
    const payload = updateFulfillmentStatusSchema.parse(request.body);
    const merchantId = request.auth.merchant_id;
    const staffId = request.auth.sub;

    const result = await transactionService.updateFulfillmentStatus({
      merchantId,
      transactionId: request.params.id,
      payload,
    });

    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function manualPay(request, response, next) {
  try {
    const payload = manualPaymentSchema.parse(request.body);
    const merchantId = request.auth.merchant_id;
    const staffId = request.auth.sub;

    const result = await transactionService.manualPay({
      merchantId,
      transactionId: request.params.id,
      staffId,
      payload,
    });

    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  updateFulfillmentStatus,
  manualPay,
};