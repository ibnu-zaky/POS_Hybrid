const { z } = require("zod");

const itemSchema = z.object({
  menu_item_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().trim().min(1).max(255).optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  quantity: z.number().int().positive(),
  unit_price: z.number().int().nonnegative().optional(),
  discount_amount: z.number().int().nonnegative().default(0),
  note: z.string().trim().max(500).optional(),
}).strict();

const createTransactionSchema = z.object({
  order_number: z.string().trim().min(1).max(100).optional(),
  idempotency_key: z.string().trim().min(1).max(100).optional(),
  items: z.array(itemSchema.refine((item) => item.menu_item_id || item.unit_price !== undefined, {
    message: "Each item requires menu_item_id or legacy unit_price",
  })).min(1),
  payment_method: z.enum(["cash", "card", "ewallet", "bank_transfer", "qris"]).default("cash"),
  amount_paid: z.number().int().nonnegative().optional(),
  source: z.enum(["kasir", "qr"]).default("kasir"),
  order_type: z.enum(["dine", "take"]).default("dine"),
  table_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().trim().max(120).optional(),
  discount_pct: z.number().min(0).max(100).default(0),
  tax_pct: z.number().min(0).max(100).default(11),
  notes: z.string().max(1000).optional(),
}).strict().refine(
  (transaction) => transaction.source !== "qr"
    || (transaction.order_type === "dine" && transaction.table_id && transaction.items.every((item) => item.menu_item_id)),
  { message: "QR dine-in orders require a table and catalog menu items" },
);

const updateTransactionSchema = z.object({
  status: z.enum(["draft", "completed", "cancelled", "refunded"]).optional(),
  payment_method: z.enum(["cash", "card", "ewallet", "bank_transfer"]).optional(),
  amount_paid: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(itemSchema.refine((item) => item.menu_item_id || item.unit_price !== undefined, {
    message: "Each item requires menu_item_id or legacy unit_price",
  })).optional(),
}).strict();

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
};
