"use strict";

const { z } = require("zod");

// GET /pos/orders?filter[]=fulfillment_status=baru&filter[]=payment_status=paid&status=...&source=qr&table_id=uuid&limit=20&offset=0
const filterParamSchema = z.object({
  key: z.enum(["fulfillment_status", "payment_status", "status", "source"]).default("status"),
  value: z.string().optional(),
  operator: z.enum(["eq", "ne"]).default("eq"),
});

const ordersQuerySchema = z.object({
  filters: z.array(filterParamSchema).optional(),
  status: z.enum(["baru", "diterima", "diproses", "siap", "selesai", "ditolak"]).optional(),
  source: z.enum(["kasir", "qr"]).optional(),
  table_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  since: z.coerce.number().int().min(0).optional(), // untuk polling streaming
}).strict();

// PATCH /pos/orders/:id/status
const updateFulfillmentStatusSchema = z.object({
  fulfillment_status: z.enum(["baru", "diterima", "diproses", "siap", "selesai", "ditolak"]).optional(),
  reject_reason: z.string().trim().max(500).optional(),
}).strict();

// POST /pos/orders/:id/pay
const manualPaymentSchema = z.object({
  payment_method: z.enum(["cash", "card", "qris"]).default("cash"),
  amount_paid: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
}).strict();

module.exports = {
  ordersQuerySchema,
  updateFulfillmentStatusSchema,
  manualPaymentSchema,
};
