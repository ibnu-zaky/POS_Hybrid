const { z } = require("zod");

const itemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().trim().min(1).max(255).optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  discount_amount: z.number().nonnegative().default(0),
}).strict();

const createTransactionSchema = z.object({
  order_number: z.string().trim().min(1).max(100).optional(),
  idempotency_key: z.string().trim().min(1).max(100).optional(),
  items: z.array(itemSchema).min(1),
  payment_method: z.enum(["cash", "card", "ewallet", "bank_transfer"]).default("cash"),
  amount_paid: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
}).strict();

const updateTransactionSchema = z.object({
  status: z.enum(["draft", "completed", "cancelled", "refunded"]).optional(),
  payment_method: z.enum(["cash", "card", "ewallet", "bank_transfer"]).optional(),
  amount_paid: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(itemSchema).optional(),
}).strict();

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
};
