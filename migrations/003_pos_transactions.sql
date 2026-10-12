BEGIN;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  order_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'ewallet', 'bank_transfer')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_transactions_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  product_id UUID,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_transaction_items_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS transactions_merchant_created_idx
  ON transactions (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_merchant_status_idx
  ON transactions (merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS transaction_items_transaction_idx
  ON transaction_items (transaction_id);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON transaction_items TO pos_app;

COMMIT;
