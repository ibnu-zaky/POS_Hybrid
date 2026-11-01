"use strict";

const { z } = require("zod");

// PIN 4-6 digit; pin dikirim sebagai string agar leading zero tidak hilang.
const pinLoginSchema = z
  .object({
    merchant_code: z.string().trim().min(1).max(64).optional(),
    device_token: z.string().trim().min(16).max(512).optional(),
    staff_id: z.string().uuid().optional(),
    email: z.string().trim().email().max(255).optional(),
    pin: z.string().trim().regex(/^\d{4,6}$/, "PIN harus 4-6 digit"),
    device_id: z.string().trim().min(1).max(255),
  })
  .strict()
  .refine((v) => v.merchant_code || v.device_token, {
    message: "merchant_code atau device_token wajib diisi",
  })
  .refine((v) => v.staff_id || v.email, {
    message: "staff_id atau email wajib diisi",
  });

// Admin (email+password) membuat kode pairing sekali pakai.
const createPairingSchema = z
  .object({
    device_label: z.string().trim().min(1).max(255).optional(),
    ttl_minutes: z.number().int().min(1).max(60).default(10),
  })
  .strict();

// Tablet menukar kode pairing jadi device_token permanen.
const redeemPairingSchema = z
  .object({
    pairing_code: z.string().trim().min(6).max(32),
    device_id: z.string().trim().min(1).max(255),
  })
  .strict();

module.exports = {
  pinLoginSchema,
  createPairingSchema,
  redeemPairingSchema,
};
