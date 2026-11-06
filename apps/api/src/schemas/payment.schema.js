const { z } = require("zod");

const createPaymentSchema = z.object({
  provider: z.enum(["stripe", "xendit", "qris", "dummy"]),
  payment_method: z.string().trim().min(1).max(50),
  currency: z.string().length(3).optional(),
  customer: z.object({ email: z.string().email().optional() }).optional(),
}).strict();

module.exports = { createPaymentSchema };