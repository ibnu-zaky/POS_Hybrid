BEGIN;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_merchant_key ON idempotency_keys (merchant_id, key);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idempotency_keys_isolation ON idempotency_keys;
CREATE POLICY idempotency_keys_isolation ON idempotency_keys
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO pos_app;

COMMIT;
