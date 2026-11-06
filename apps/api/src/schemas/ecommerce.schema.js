"use strict";

const { z } = require("zod");

const marketplaceEnum = z.enum(["tokopedia", "shopee", "woocommerce", "dummy"]);
const orderStatusEnum = z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"]);

const createConnectionSchema = z.object({
  marketplace: marketplaceEnum,
  store_name: z.string().min(1).max(100),
  api_key: z.string().min(1).max(500).optional(),
  api_secret: z.string().min(1).max(500).optional(),
  webhook_url: z.string().url().max(500).optional(),
});

const updateConnectionSchema = z.object({
  store_name: z.string().min(1).max(100).optional(),
  api_key: z.string().min(1).max(500).optional(),
  api_secret: z.string().min(1).max(500).optional(),
  webhook_url: z.string().url().max(500).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const listOrdersQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const fulfillOrderSchema = z.object({
  status: z.enum(["confirmed", "shipped", "delivered", "cancelled"]),
  tracking_number: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
});

module.exports = {
  createConnectionSchema,
  updateConnectionSchema,
  listOrdersQuerySchema,
  fulfillOrderSchema,
  orderStatusEnum,
  marketplaceEnum,
};
