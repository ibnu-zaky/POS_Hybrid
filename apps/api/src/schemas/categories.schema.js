"use strict";

const { z } = require("zod");

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  icon: z.string().trim().max(30).optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
}).strict();

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  icon: z.string().trim().max(30).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
}).strict();

const reorderCategoriesSchema = z.object({
  category_ids: z.array(z.string().uuid()).min(1),
}).strict();

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
};