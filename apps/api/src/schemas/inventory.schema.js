const { z } = require("zod");

const createInventorySchema = z.object({
  sku: z.string().trim().min(1).max(100),
  product_name: z.string().trim().min(1).max(255),
  quantity: z.number().int().min(0).default(0),
  reorder_point: z.number().int().min(0).default(10),
  unit_cost: z.number().nonnegative().optional().nullable(),
}).strict();

const updateInventorySchema = z.object({
  product_name: z.string().trim().min(1).max(255).optional(),
  reorder_point: z.number().int().min(0).optional(),
  unit_cost: z.number().nonnegative().optional(),
}).strict();

const adjustStockSchema = z.object({
  quantity: z.number().int(),
  reference_id: z.string().trim().max(100).optional().nullable(),
}).strict();

module.exports = {
  createInventorySchema,
  updateInventorySchema,
  adjustStockSchema,
};
