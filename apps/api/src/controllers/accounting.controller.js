"use strict";

const accountingService = require("../services/accounting.service");
const {
  createConnectionSchema,
  updateConnectionSchema,
  generateJournalSchema,
  listJournalQuerySchema,
  createTaxInvoiceSchema,
  listTaxInvoiceQuerySchema,
} = require("../schemas/accounting.schema");

function tenant(request) { return request.auth.merchant_id; }
function staffId(request) { return request.auth.sub; }

// ——— Connections ———

async function listConnections(request, response, next) {
  try {
    const data = await accountingService.listConnections({ merchantId: tenant(request) });
    response.json({ data });
  } catch (error) { next(error); }
}

async function createConnection(request, response, next) {
  try {
    const body = createConnectionSchema.parse(request.body);
    const conn = await accountingService.createConnection({ merchantId: tenant(request), ...body });
    response.status(201).json(conn);
  } catch (error) { next(error); }
}

async function updateConnection(request, response, next) {
  try {
    const body = updateConnectionSchema.parse(request.body);
    const conn = await accountingService.updateConnection({
      merchantId: tenant(request),
      id: request.params.id,
      ...body,
    });
    response.json(conn);
  } catch (error) { next(error); }
}

async function deleteConnection(request, response, next) {
  try {
    const result = await accountingService.deleteConnection({
      merchantId: tenant(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

// ——— Journal ———

async function generateDailyJournal(request, response, next) {
  try {
    const body = generateJournalSchema.parse(request.query);
    const entry = await accountingService.generateDailyJournal({
      merchantId: tenant(request),
      staffId: staffId(request),
      date: body.date,
    });
    response.status(201).json(entry);
  } catch (error) { next(error); }
}

async function listJournal(request, response, next) {
  try {
    const query = listJournalQuerySchema.parse(request.query);
    const data = await accountingService.listJournal({ merchantId: tenant(request), ...query });
    response.json({ data });
  } catch (error) { next(error); }
}

async function getJournal(request, response, next) {
  try {
    const entry = await accountingService.getJournal({ merchantId: tenant(request), id: request.params.id });
    response.json(entry);
  } catch (error) { next(error); }
}

async function postJournal(request, response, next) {
  try {
    const result = await accountingService.postJournal({
      merchantId: tenant(request),
      staffId: staffId(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

async function syncJournal(request, response, next) {
  try {
    const { journal_id } = request.body;
    if (!journal_id) {
      return response.status(400).json({ error: "journal_id wajib diisi" });
    }
    const result = await accountingService.syncJournal({
      merchantId: tenant(request),
      connectionId: request.params.id,
      journalId: journal_id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

// ——— Tax Invoices ———

async function createTaxInvoice(request, response, next) {
  try {
    const body = createTaxInvoiceSchema.parse(request.body);
    const invoice = await accountingService.createTaxInvoice({ merchantId: tenant(request), payload: body });
    response.status(201).json(invoice);
  } catch (error) { next(error); }
}

async function listTaxInvoices(request, response, next) {
  try {
    const query = listTaxInvoiceQuerySchema.parse(request.query);
    const data = await accountingService.listTaxInvoices({ merchantId: tenant(request), ...query });
    response.json({ data });
  } catch (error) { next(error); }
}

async function issueTaxInvoice(request, response, next) {
  try {
    const result = await accountingService.issueTaxInvoice({
      merchantId: tenant(request),
      id: request.params.id,
    });
    response.json(result);
  } catch (error) { next(error); }
}

module.exports = {
  listConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  generateDailyJournal,
  listJournal,
  getJournal,
  postJournal,
  syncJournal,
  createTaxInvoice,
  listTaxInvoices,
  issueTaxInvoice,
};
