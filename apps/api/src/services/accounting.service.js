"use strict";

const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const accountingRepository = require("../repositories/accounting.repository");
const { getAdapter } = require("../accounting/factory");
const { round2 } = require("@pos/core");

const GL_ACCOUNTS = {
  CASH: { code: "1000", name: "Cash / Bank" },
  AR: { code: "1200", name: "Accounts Receivable" },
  INVENTORY: { code: "1300", name: "Inventory" },
  SALES: { code: "4100", name: "Sales Revenue" },
  COGS: { code: "5100", name: "Cost of Goods Sold" },
  TAX_OUT: { code: "2100", name: "PPn Keluaran" },
};

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(process.env.JWT_ACCESS_SECRET || "dev-secret", "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(text), "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!text) return null;
  try {
    const [ivHex, dataHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = crypto.scryptSync(process.env.JWT_ACCESS_SECRET || "dev-secret", "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function todayInJakarta() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function roundMoney(n) {
  return round2(Number(n));
}

// ——— Connections ———

async function listConnections({ merchantId }) {
  return withTenantContext(merchantId, (client) =>
    accountingRepository.listConnections(client, { merchantId }),
  );
}

async function createConnection({ merchantId, provider, company_id, credentials }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await accountingRepository.findConnectionByProvider(client, { merchantId, provider });
    if (existing) {
      throw Object.assign(new Error(`Provider ${provider} sudah terdaftar untuk merchant ini`), { statusCode: 409 });
    }
    getAdapter(provider);

    return accountingRepository.createConnection(client, {
      merchantId,
      provider,
      companyId: company_id,
      credentialsEncrypted: encrypt(credentials),
    });
  });
}

async function updateConnection({ merchantId, id, ...fields }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await accountingRepository.findConnectionById(client, { merchantId, id });
    if (!existing) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }

    const updateData = {};
    if (fields.company_id !== undefined) updateData.companyId = fields.company_id;
    if (fields.credentials !== undefined) updateData.credentialsEncrypted = encrypt(fields.credentials);
    if (fields.status !== undefined) updateData.status = fields.status;

    return accountingRepository.updateConnection(client, { merchantId, id, ...updateData });
  });
}

async function deleteConnection({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const deleted = await accountingRepository.deleteConnection(client, { merchantId, id });
    if (!deleted) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }
    return { deleted: true };
  });
}

// ——— Journal Harian ———

async function generateDailyJournal({ merchantId, staffId, date }) {
  const entryDate = date || todayInJakarta();

  return withTenantContext(merchantId, async (client) => {
    // Cek apakah journal untuk tanggal ini sudah ada
    const existing = await accountingRepository.findJournalByRef(client, {
      merchantId,
      entryDate,
      referenceType: "sales_report",
    });
    if (existing) {
      throw Object.assign(
        new Error(`Journal untuk tanggal ${entryDate} sudah dibuat (status: ${existing.status})`),
        { statusCode: 409 },
      );
    }

    const agg = await accountingRepository.aggregateDailySales(client, { merchantId, date: entryDate });
    const totalSales = roundMoney(agg.total_sales);
    const totalTax = roundMoney(agg.total_tax);
    const estimatedCogs = roundMoney(agg.estimated_cogs);
    const dpp = roundMoney(totalSales - totalTax); // revenue ex-tax

    if (totalSales === 0 && estimatedCogs === 0) {
      throw Object.assign(
        new Error(`Tidak ada transaksi completed pada tanggal ${entryDate}`),
        { statusCode: 400 },
      );
    }

    // GL lines
    const lines = [];
    // DR Cash (grand_total diterima)
    if (totalSales > 0) lines.push({ ...GL_ACCOUNTS.CASH, debit: totalSales, credit: 0 });
    // CR Sales (DPP)
    if (dpp > 0) lines.push({ ...GL_ACCOUNTS.SALES, debit: 0, credit: dpp });
    // CR Tax PPn Keluaran
    if (totalTax > 0) lines.push({ ...GL_ACCOUNTS.TAX_OUT, debit: 0, credit: totalTax });
    // DR COGS
    if (estimatedCogs > 0) lines.push({ ...GL_ACCOUNTS.COGS, debit: estimatedCogs, credit: 0 });
    // CR Inventory
    if (estimatedCogs > 0) lines.push({ ...GL_ACCOUNTS.INVENTORY, debit: 0, credit: estimatedCogs });

    const totalDebit = roundMoney(lines.reduce((sum, l) => sum + l.debit, 0));
    const totalCredit = roundMoney(lines.reduce((sum, l) => sum + l.credit, 0));

    const entry = await accountingRepository.createJournalEntry(client, {
      merchantId,
      entryDate,
      referenceType: "sales_report",
      description: `Daily sales journal ${entryDate}`,
      totalDebit,
      totalCredit,
    });

    for (const line of lines) {
      await accountingRepository.insertJournalLine(client, {
        journalEntryId: entry.id,
        merchantId,
        accountCode: line.code,
        accountName: line.name,
        debit: line.debit,
        credit: line.credit,
      });
    }

    const formattedLines = lines.map((l) => ({
      account_code: l.code,
      account_name: l.name,
      debit: l.debit,
      credit: l.credit,
    }));

    return { ...entry, lines: formattedLines };
  });
}

async function listJournal({ merchantId, from, to, status, limit, offset }) {
  return withTenantContext(merchantId, (client) =>
    accountingRepository.listJournalEntries(client, { merchantId, from, to, status, limit, offset }),
  );
}

async function getJournal({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const entry = await accountingRepository.findJournalById(client, { merchantId, id });
    if (!entry) {
      throw Object.assign(new Error("Journal entry tidak ditemukan"), { statusCode: 404 });
    }
    return entry;
  });
}

async function postJournal({ merchantId, staffId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const posted = await accountingRepository.postJournalEntry(client, { merchantId, id, postedBy: staffId });
    if (!posted) {
      throw Object.assign(
        new Error("Journal entry tidak ditemukan atau sudah posted"),
        { statusCode: 404 },
      );
    }
    return posted;
  });
}

// ——— Sync ke Provider ———

async function syncJournal({ merchantId, connectionId, journalId }) {
  return withTenantContext(merchantId, async (client) => {
    const conn = await accountingRepository.findConnectionById(client, { merchantId, id: connectionId });
    if (!conn) {
      throw Object.assign(new Error("Connection tidak ditemukan"), { statusCode: 404 });
    }
    if (conn.status !== "active") {
      throw Object.assign(new Error("Connection tidak aktif"), { statusCode: 400 });
    }

    const journal = await accountingRepository.findJournalById(client, { merchantId, id: journalId });
    if (!journal) {
      throw Object.assign(new Error("Journal entry tidak ditemukan"), { statusCode: 404 });
    }
    if (journal.status !== "posted") {
      throw Object.assign(new Error("Hanya journal berstatus posted yang bisa di-sync"), { statusCode: 400 });
    }

    const adapter = getAdapter(conn.provider, {
      company_id: conn.company_id,
      credentials: decrypt(conn.credentials_encrypted),
    });

    const result = await adapter.pushJournal(journal);
    await accountingRepository.touchLastSync(client, { merchantId, id: connectionId });

    return result;
  });
}

// ——— Tax Invoices (Faktur Pajak) ———

async function createTaxInvoice({ merchantId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const count = await accountingRepository.countTaxInvoices(client, { merchantId });
    const seq = String(count + 1).padStart(5, "0");
    const invoiceNumber = `INV-${payload.invoice_date.replace(/-/g, "")}-${seq}`;

    const dppAmount = roundMoney(payload.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
    const ppnRate = payload.ppn_rate ?? 0.11;
    const ppnAmount = roundMoney(dppAmount * ppnRate);
    const totalAmount = roundMoney(dppAmount + ppnAmount);

    return accountingRepository.createTaxInvoice(client, {
      merchantId,
      invoiceNumber,
      invoiceDate: payload.invoice_date,
      customerName: payload.customer_name,
      customerTaxId: payload.customer_tax_id,
      customerAddress: payload.customer_address,
      items: payload.items,
      dppAmount,
      ppnRate,
      ppnAmount,
      totalAmount,
    });
  });
}

async function listTaxInvoices({ merchantId, from, to, status, limit, offset }) {
  return withTenantContext(merchantId, (client) =>
    accountingRepository.listTaxInvoices(client, { merchantId, from, to, status, limit, offset }),
  );
}

async function issueTaxInvoice({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const count = await accountingRepository.countTaxInvoices(client, { merchantId });
    const fakturNumber = `010.000-26.${String(count).padStart(5, "0")}`;

    const issued = await accountingRepository.issueTaxInvoice(client, {
      merchantId,
      id,
      fakturPajakNumber: fakturNumber,
    });
    if (!issued) {
      throw Object.assign(
        new Error("Tax invoice tidak ditemukan atau sudah tidak draft"),
        { statusCode: 404 },
      );
    }
    return issued;
  });
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
  GL_ACCOUNTS,
};
