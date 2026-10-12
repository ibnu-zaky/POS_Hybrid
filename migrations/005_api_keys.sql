BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_merchant_idx ON api_keys (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON api_keys (key_hash, revoked_at, expires_at);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_keys_isolation ON api_keys;
CREATE POLICY api_keys_isolation ON api_keys
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO pos_app;

CREATE OR REPLACE FUNCTION public.lookup_api_key(p_key_hash VARCHAR)
RETURNS TABLE (id UUID, merchant_id UUID, created_by UUID)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, merchant_id, created_by
  FROM api_keys
  WHERE key_hash = p_key_hash
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.touch_api_key(p_key_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE api_keys SET last_used_at = NOW() WHERE id = p_key_id
$$;

GRANT EXECUTE ON FUNCTION public.lookup_api_key(VARCHAR) TO pos_app;
GRANT EXECUTE ON FUNCTION public.touch_api_key(UUID) TO pos_app;

COMMIT;