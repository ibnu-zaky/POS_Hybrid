"use strict";

const publicService = require("../services/public.service");
const { publicCreateOrderSchema, publicStatusQuerySchema } = require("../schemas/public.schema");

async function getMenu(request, response, next) {
  try {
    const { token } = request.params;
    const data = await publicService.getMenuByToken(token);
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createOrder(request, response, next) {
  try {
    const { token } = request.params;
    const body = publicCreateOrderSchema.parse(request.body);
    const idempotencyKey = request.get("Idempotency-Key");
    if (!idempotencyKey) {
      return response.status(400).json({ error: "Idempotency-Key header is required" });
    }

    const order = await publicService.createQrOrder({
      token,
      payload: body,
      idempotencyKey,
    });

    response.status(order.replayed ? 200 : 201).json({
      data: {
        order_id: order.id,
        public_token: order.public_token,
        status: order.fulfillment_status,
        order_number: order.order_number,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getStatus(request, response, next) {
  try {
    const { id } = request.params;
    const { pt } = publicStatusQuerySchema.parse(request.query);

    const status = await publicService.getOrderStatus({
      orderId: id,
      publicToken: pt,
    });

    // Jangan bocorkan kolom internal (merchant_id) ke pelanggan.
    response.json({
      data: {
        id: status.id,
        order_number: status.order_number,
        status: status.status,
        fulfillment_status: status.fulfillment_status,
        reject_reason: status.reject_reason,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMenu,
  createOrder,
  getStatus,
};
