"use strict";

const { z } = require("zod");

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

const dateField = z.string().refine(isValidDateString, "must be a valid date YYYY-MM-DD");

const salesByProductQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const marginQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const slowMovingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const turnoverQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  salesByProductQuerySchema,
  marginQuerySchema,
  slowMovingQuerySchema,
  turnoverQuerySchema,
};
