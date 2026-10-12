"use strict";

const { z } = require("zod");

const providerEnum = z.enum(["xero", "myob", "quickbooks", "dummy"]);
const journalStatusEnum = z.enum(["draft", "posted"]);
const taxInvoiceStatusEnum = z.enum(["draft", "issued", "cancelled"]);

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateField = z.string().refine(isValidDateString, "must be a valid date YYYY-MM-DD");

const createConnectionSchema = z.object({
  provider: providerEnum,
  company_id: z.string().max(100).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
});

const updateConnectionSchema = z.object({
  company_id: z.string().max(100).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const generateJournalSchema = z.object({
  date: dateField.optional(),
});

const listJournalQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  status: journalStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createTaxInvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
});

const createTaxInvoiceSchema = z.object({
  invoice_date: dateField,
  customer_name: z.string().min(1).max(200),
  customer_tax_id: z.string().max(30).optional(),
  customer_address: z.string().max(500).optional(),
  items: z.array(createTaxInvoiceItemSchema).min(1).max(100),
  ppn_rate: z.number().min(0).max(0.12).default(0.11),
});

const listTaxInvoiceQuerySchema = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
  status: taxInvoiceStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = {
  createConnectionSchema,
  updateConnectionSchema,
  generateJournalSchema,
  listJournalQuerySchema,
  createTaxInvoiceSchema,
  listTaxInvoiceQuerySchema,
  providerEnum,
  journalStatusEnum,
  taxInvoiceStatusEnum,
};
