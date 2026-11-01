"use strict";

const { z } = require("zod");

const publicOrderItemSchema = z.object({
  menu_item_id: z.string().uuid("Invalid menu_item_id format"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(20, "Quantity cannot exceed 20"),
  note: z.string().trim().max(60, "Note cannot exceed 60 characters").optional(),
}).strict();

const publicCreateOrderSchema = z.object({
  customer_name: z.string().trim().max(24, "Customer name cannot exceed 24 characters").optional(),
  payment_pref: z.enum(["kasir", "qris"]).default("kasir"),
  items: z.array(publicOrderItemSchema).min(1, "Order must contain at least 1 item").max(30, "Order cannot contain more than 30 items"),
}).strict();

const publicStatusQuerySchema = z.object({
  pt: z.string().trim().min(1, "public_token is required"),
});

module.exports = {
  publicOrderItemSchema,
  publicCreateOrderSchema,
  publicStatusQuerySchema,
};
