const { z } = require("zod");

const loginSchema = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(1024),
    device_id: z.string().trim().min(1).max(255),
  })
  .strict();

const tenantIdSchema = z.string().uuid();

module.exports = {
  loginSchema,
  tenantIdSchema,
};
