"use strict";

// ——— Connections ———

async function listConnections(client, { merchantId }) {
  const result = await client.query(
    `SELECT id, provider, company_id, status, last_sync_at, created_at, updated_at
     FROM accounting_connections
     WHERE merchant_id = $1
     ORDER BY created_at DESC`,
    [merchantId],
  );
  return result.rows;
}

async function findConnectionById(client, { merchantId, id }) {
  const result = await client.query(
    `SELECT id, provider, company_id, credentials_encrypted, status, last_sync_at
     FROM accounting_connections
     WHERE merchant_id = $1 AND id = $2`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function findConnectionByProvider(client, { merchantId, provider }) {
  const result = await client.query(
    `SELECT id FROM accounting_connections
     WHERE merchant_id = $1 AND provider = $2`,
    [merchantId, provider],
  );
  return result.rows[0] || null;
}

async function createConnection(client, { merchantId, provider, companyId, credentialsEncrypted }) {
  const result = await client.query(
    `INSERT INTO accounting_connections (merchant_id, provider, company_id, credentials_encrypted)
     VALUES ($1, $2, $3, $4)
     RETURNING id, provider, company_id, status, created_at`,
    [merchantId, provider, companyId || null, credentialsEncrypted || null],
  );
  return result.rows[0];
}

async function updateConnection(client, { merchantId, id, companyId, credentialsEncrypted, status }) {
  const sets = [];
  const params = [merchantId, id];
  let paramIdx = 3;

  if (companyId !== undefined) { sets.push(`company_id = $${paramIdx++}`); params.push(companyId); }
  if (credentialsEncrypted !== undefined) { sets.push(`credentials_encrypted = $${paramIdx++}`); params.push(credentialsEncrypted); }
  if (status !== undefined) { sets.push(`status = $${paramIdx++}`); params.push(status); }
  sets.push(`updated_at = NOW()`);

  const result = await client.query(
    `UPDATE accounting_connections
     SET ${sets.join(", ")}
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, provider, company_id, status, updated_at`,
    params,
  );
  return result.rows[0] || null;
}

async function deleteConnection(client, { merchantId, id }) {
  const result = await client.query(
    `DELETE FROM accounting_connections WHERE merchant_id = $1 AND id = $2 RETURNING id`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function touchLastSync(client, { merchantId, id }) {
  await client.query(
    `UPDATE accounting_connections SET last_sync_at = NOW(), updated_at = NOW() WHERE merchant_id = $1 AND id = $2`,
    [merchantId, id],
  );
}

// ——— Journal ———

async function findJournalByRef(client, { merchantId, entryDate, referenceType, referenceId }) {
  const result = await client.query(
    `SELECT id, status FROM journal_entries
     WHERE merchant_id = $1 AND entry_date = $2 AND reference_type = $3
       AND reference_id IS NOT DISTINCT FROM $4`,
    [merchantId, entryDate, referenceType, referenceId || null],
  );
  return result.rows[0] || null;
}

async function createJournalEntry(client, { merchantId, entryDate, referenceType, referenceId, description, totalDebit, totalCredit }) {
  const result = await client.query(
    `INSERT INTO journal_entries (merchant_id, entry_date, reference_type, reference_id, description, total_debit, total_credit)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, entry_date, reference_type, description, total_debit, total_credit, status, created_at`,
    [merchantId, entryDate, referenceType, referenceId || null, description || null, totalDebit, totalCredit],
  );
  return result.rows[0];
}

async function insertJournalLine(client, { journalEntryId, merchantId, accountCode, accountName, debit, credit, memo }) {
  await client.query(
    `INSERT INTO journal_lines (journal_entry_id, merchant_id, account_code, account_name, debit, credit, memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [journalEntryId, merchantId, accountCode, accountName, debit, credit, memo || null],
  );
}

async function listJournalEntries(client, { merchantId, from, to, status, limit, offset }) {
  const conditions = ["je.merchant_id = $1"];
  const params = [merchantId];
  let paramIdx = 2;

  if (status) { conditions.push(`je.status = $${paramIdx++}`); params.push(status); }
  if (from) { conditions.push(`je.entry_date >= $${paramIdx++}::date`); params.push(from); }
  if (to) { conditions.push(`je.entry_date <= $${paramIdx++}::date`); params.push(to); }

  params.push(limit, offset);

  const result = await client.query(
    `SELECT je.id, je.entry_date, je.reference_type, je.description,
            je.total_debit, je.total_credit, je.status, je.posted_at, je.created_at,
            COALESCE(json_agg(json_build_object(
              'account_code', jl.account_code,
              'account_name', jl.account_name,
              'debit', jl.debit,
              'credit', jl.credit,
              'memo', jl.memo
            ) ORDER BY jl.account_code) FILTER (WHERE jl.id IS NOT NULL), '[]'::json) AS lines
     FROM journal_entries je
     LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY je.id
     ORDER BY je.entry_date DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );
  return result.rows;
}

async function findJournalById(client, { merchantId, id }) {
  const result = await client.query(
    `SELECT je.*, COALESCE(json_agg(json_build_object(
        'account_code', jl.account_code,
        'account_name', jl.account_name,
        'debit', jl.debit,
        'credit', jl.credit,
        'memo', jl.memo
      ) ORDER BY jl.account_code) FILTER (WHERE jl.id IS NOT NULL), '[]'::json) AS lines
     FROM journal_entries je
     LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
     WHERE je.merchant_id = $1 AND je.id = $2
     GROUP BY je.id`,
    [merchantId, id],
  );
  return result.rows[0] || null;
}

async function postJournalEntry(client, { merchantId, id, postedBy }) {
  const result = await client.query(
    `UPDATE journal_entries
     SET status = 'posted', posted_at = NOW(), posted_by = $3, updated_at = NOW()
     WHERE merchant_id = $1 AND id = $2 AND status = 'draft'
     RETURNING id, status, posted_at`,
    [merchantId, id, postedBy],
  );
  return result.rows[0] || null;
}

// ——— Agregasi transaksi untuk journal harian ———

async function aggregateDailySales(client, { merchantId, date }) {
  const result = await client.query(
    `SELECT
       COALESCE(SUM(t.grand_total), 0)::float AS total_sales,
       COALESCE(SUM(t.tax_amount), 0)::float AS total_tax,
       COALESCE(SUM(t.discount_amount), 0)::float AS total_discount,
       COALESCE(SUM(ti.quantity * COALESCE(i.unit_cost, 0)), 0)::float AS estimated_cogs
     FROM transactions t
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     LEFT JOIN inventory i ON i.merchant_id = t.merchant_id AND i.sku = ti.sku
     WHERE t.merchant_id = $1
       AND t.status = 'completed'
       AND (t.created_at AT TIME ZONE 'Asia/Jakarta')::date = $2::date`,
    [merchantId, date],
  );
  return result.rows[0] || { total_sales: 0, total_tax: 0, total_discount: 0, estimated_cogs: 0 };
}

// ——— Tax Invoices ———

async function createTaxInvoice(client, { merchantId, invoiceNumber, invoiceDate, customerName, customerTaxId, customerAddress, items, dppAmount, ppnRate, ppnAmount, totalAmount }) {
  const result = await client.query(
    `INSERT INTO tax_invoices (merchant_id, invoice_number, invoice_date, customer_name, customer_tax_id, customer_address, items, dpp_amount, ppn_rate, ppn_amount, total_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, invoice_number, invoice_date, customer_name, dpp_amount, ppn_rate, ppn_amount, total_amount, status, created_at`,
    [merchantId, invoiceNumber, invoiceDate, customerName, customerTaxId || null, customerAddress || null, JSON.stringify(items), dppAmount, ppnRate, ppnAmount, totalAmount],
  );
  return result.rows[0];
}

async function listTaxInvoices(client, { merchantId, from, to, status, limit, offset }) {
  const conditions = ["merchant_id = $1"];
  const params = [merchantId];
  let paramIdx = 2;

  if (status) { conditions.push(`status = $${paramIdx++}`); params.push(status); }
  if (from) { conditions.push(`invoice_date >= $${paramIdx++}::date`); params.push(from); }
  if (to) { conditions.push(`invoice_date <= $${paramIdx++}::date`); params.push(to); }

  params.push(limit, offset);

  const result = await client.query(
    `SELECT id, invoice_number, invoice_date, customer_name, customer_tax_id,
            items, dpp_amount, ppn_rate, ppn_amount, total_amount, status, faktur_pajak_number, created_at
     FROM tax_invoices
     WHERE ${conditions.join(" AND ")}
     ORDER BY invoice_date DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );
  return result.rows;
}

async function issueTaxInvoice(client, { merchantId, id, fakturPajakNumber }) {
  const result = await client.query(
    `UPDATE tax_invoices
     SET status = 'issued', faktur_pajak_number = $3, issued_at = NOW(), updated_at = NOW()
     WHERE merchant_id = $1 AND id = $2 AND status = 'draft'
     RETURNING id, invoice_number, status, faktur_pajak_number, issued_at`,
    [merchantId, id, fakturPajakNumber],
  );
  return result.rows[0] || null;
}

async function countTaxInvoices(client, { merchantId }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM tax_invoices WHERE merchant_id = $1`,
    [merchantId],
  );
  return result.rows[0]?.total || 0;
}

module.exports = {
  listConnections,
  findConnectionById,
  findConnectionByProvider,
  createConnection,
  updateConnection,
  deleteConnection,
  touchLastSync,
  findJournalByRef,
  createJournalEntry,
  insertJournalLine,
  listJournalEntries,
  findJournalById,
  postJournalEntry,
  aggregateDailySales,
  createTaxInvoice,
  listTaxInvoices,
  issueTaxInvoice,
  countTaxInvoices,
};
