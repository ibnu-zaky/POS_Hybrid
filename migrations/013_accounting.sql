-- 013: Accounting Integration (Phase 3.3)
-- Connections, journal entries/lines, tax invoices (Faktur Pajak).

BEGIN;

CREATE TABLE IF NOT EXISTS accounting_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL
    CHECK (provider IN ('xero', 'myob', 'quickbooks', 'dummy')),
  company_id VARCHAR(100),
  credentials_encrypted TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accounting_conn_merchant_provider_unique UNIQUE (merchant_id, provider)
);

CREATE INDEX IF NOT EXISTS accounting_conn_merchant_idx
  ON accounting_connections (merchant_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  reference_type VARCHAR(30) NOT NULL DEFAULT 'sales_report'
    CHECK (reference_type IN ('sales_report', 'manual', 'adjustment')),
  reference_id UUID,
  description TEXT,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted')),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journal_balance_check CHECK (total_debit = total_credit)
);

CREATE UNIQUE INDEX IF NOT EXISTS journal_merchant_date_ref_unique
  ON journal_entries (merchant_id, entry_date, reference_type, COALESCE(reference_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS journal_merchant_date_idx
  ON journal_entries (merchant_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS journal_merchant_status_idx
  ON journal_entries (merchant_id, status);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  account_code VARCHAR(10) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0
    CHECK (debit >= 0),
  credit NUMERIC(15,2) NOT NULL DEFAULT 0
    CHECK (credit >= 0),
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx
  ON journal_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS journal_lines_merchant_account_idx
  ON journal_lines (merchant_id, account_code);

CREATE TABLE IF NOT EXISTS tax_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_tax_id VARCHAR(30),
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  dpp_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ppn_rate NUMERIC(5,4) NOT NULL DEFAULT 0.11
    CHECK (ppn_rate >= 0 AND ppn_rate <= 0.12),
  ppn_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'cancelled')),
  faktur_pajak_number VARCHAR(50),
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_invoice_number_unique UNIQUE (merchant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS tax_invoice_merchant_date_idx
  ON tax_invoices (merchant_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS tax_invoice_merchant_status_idx
  ON tax_invoices (merchant_id, status);

ALTER TABLE accounting_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE accounting_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_conn_isolation ON accounting_connections;
CREATE POLICY accounting_conn_isolation ON accounting_connections
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS journal_entries_isolation ON journal_entries;
CREATE POLICY journal_entries_isolation ON journal_entries
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS journal_lines_isolation ON journal_lines;
CREATE POLICY journal_lines_isolation ON journal_lines
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS tax_invoices_isolation ON tax_invoices;
CREATE POLICY tax_invoices_isolation ON tax_invoices
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
ON accounting_connections, journal_entries, journal_lines, tax_invoices
TO pos_app;

COMMIT;
