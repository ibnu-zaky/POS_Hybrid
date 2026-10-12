"use strict";

const { z } = require("zod");

const cncStatusEnum = z.enum(["pending", "ready", "picked_up", "expired", "cancelled"]);

const reservedItemSchema = z.object({
  sku: z.string().min(1).max(100),
  product_name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
});

const createReservationSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(30).optional(),
  items: z.array(reservedItemSchema).min(1).max(50),
  source_order_id: z.uuid().optional(),
  notes: z.string().max(500).optional(),
});

const listReservationsQuerySchema = z.object({
  status: cncStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const verifyPickupSchema = z.object({
  pickup_code: z.string().min(6).max(8),
});

module.exports = {
  createReservationSchema,
  listReservationsQuerySchema,
  verifyPickupSchema,
  cncStatusEnum,
};
