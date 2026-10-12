BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_status_check') THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('stripe', 'xendit', 'qris', 'dummy')),
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  provider_payment_id VARCHAR(255),
  provider_reference VARCHAR(255),
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code VARCHAR(100),
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique_idx
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_active_transaction_unique_idx
  ON payments (transaction_id)
  WHERE status IN ('pending', 'paid');
CREATE INDEX IF NOT EXISTS payments_merchant_created_idx ON payments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_transaction_status_idx ON payments (transaction_id, status);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(30) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status VARCHAR(30) NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_isolation ON payments;
CREATE POLICY payments_isolation ON payments
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO pos_app;
GRANT SELECT, INSERT, UPDATE ON payment_webhook_events TO pos_app;
GRANT UPDATE ON transactions TO pos_app;

DROP FUNCTION IF EXISTS public.lookup_payment_webhook(VARCHAR, VARCHAR);
CREATE FUNCTION public.lookup_payment_webhook(p_provider VARCHAR, p_reference VARCHAR)
RETURNS SETOF public.payments
AS $$
  SELECT p.*
  FROM public.payments AS p
  WHERE p.provider = p_provider AND (p.provider_payment_id = p_reference OR p.provider_reference = p_reference)
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_payment_webhook(VARCHAR, VARCHAR) TO pos_app;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check
  CHECK (provider IN ('stripe', 'xendit', 'qris', 'dummy'));

COMMIT;