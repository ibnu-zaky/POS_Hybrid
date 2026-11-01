"use strict";

const { z } = require("zod");

const createMenuItemSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  price: z.number().int().min(0),
  image_url: z.string().trim().url().optional().nullable(),
  is_available: z.boolean().default(true),
  is_active: z.boolean().default(true),
  track_stock: z.boolean().default(false),
  sku: z.string().trim().max(100).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
}).strict();

const updateMenuItemSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(120).optional(),
  price: z.number().int().min(0).optional(),
  image_url: z.string().trim().url().optional().nullable(),
  is_available: z.boolean().optional(),
  is_active: z.boolean().optional(),
  track_stock: z.boolean().optional(),
  sku: z.string().trim().max(100).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
}).strict();

const availabilitySchema = z.object({
  is_available: z.boolean(),
}).strict();

module.exports = {
  createMenuItemSchema,
  updateMenuItemSchema,
  availabilitySchema,
};