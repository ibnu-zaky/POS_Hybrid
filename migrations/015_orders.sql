BEGIN;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE dining_tables
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE transactions
  ALTER COLUMN staff_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'kasir',
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'dine',
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_number INTEGER,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'baru',
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS daily_number INTEGER,
  ADD COLUMN IF NOT EXISTS daily_date DATE,
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct NUMERIC(5,2) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_source_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
      CHECK (source IN ('kasir', 'qr'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_order_type_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_order_type_check
      CHECK (order_type IN ('dine', 'take'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_fulfillment_status_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_fulfillment_status_check
      CHECK (fulfillment_status IN ('baru', 'diterima', 'diproses', 'siap', 'selesai', 'ditolak'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_discount_pct_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_discount_pct_check
      CHECK (discount_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_tax_pct_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_tax_pct_check
      CHECK (tax_pct BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_public_token_idx
  ON transactions (public_token) WHERE public_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_daily_number_idx
  ON transactions (merchant_id, daily_date, daily_number)
  WHERE daily_number IS NOT NULL AND daily_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_merchant_fulfillment_idx
  ON transactions (merchant_id, fulfillment_status, created_at DESC);

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note VARCHAR(500);

CREATE TABLE IF NOT EXISTS order_counters (
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  counter_date DATE NOT NULL,
  last_number INTEGER NOT NULL CHECK (last_number > 0),
  PRIMARY KEY (merchant_id, counter_date)
);

ALTER TABLE order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_counters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_counters_isolation ON order_counters;
CREATE POLICY order_counters_isolation ON order_counters
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON order_counters TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON transaction_items TO pos_app;
GRANT SELECT ON categories, menu_items, dining_tables TO pos_app;

CREATE OR REPLACE VIEW v_daily_sales
WITH (security_invoker = true) AS
SELECT
  t.merchant_id,
  (t.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
  ti.sku,
  ti.product_name,
  SUM(ti.quantity)::int AS quantity,
  SUM(ti.line_total)::float AS revenue
FROM transactions t
JOIN transaction_items ti ON ti.transaction_id = t.id
WHERE t.status = 'completed' AND t.payment_status = 'paid'
GROUP BY
  t.merchant_id,
  (t.created_at AT TIME ZONE 'Asia/Jakarta')::date,
  ti.sku,
  ti.product_name;

COMMIT;
