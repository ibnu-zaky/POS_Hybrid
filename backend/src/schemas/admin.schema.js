const { z } = require("zod");

const createStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(255),
  role: z.enum(["admin", "manager", "cashier"]),
  password: z.string().min(8),
}).strict();

const updateStaffSchema = z.object({
  role: z.enum(["admin", "manager", "cashier"]).optional(),
  is_active: z.boolean().optional(),
}).strict();

const updateMerchantSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().optional(),
}).strict();

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  expires_at: z.string().datetime().optional().nullable(),
}).strict();

module.exports = { createStaffSchema, updateStaffSchema, updateMerchantSchema, createApiKeySchema };