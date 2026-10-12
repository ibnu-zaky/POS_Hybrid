BEGIN;

CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID,
  merchant_id UUID,
  device_id VARCHAR(255),
  ip_address VARCHAR(255),
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  device_id VARCHAR(255),
  token_hash VARCHAR(255) NOT NULL,
  jti VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_audit_logs_user_merchant_idx
  ON auth_audit_logs (user_id, merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_logs_event_type_idx
  ON auth_audit_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_merchant_idx
  ON refresh_tokens (user_id, merchant_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS refresh_tokens_session_idx
  ON refresh_tokens (session_id, user_id, merchant_id);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_jti_unique_idx
  ON refresh_tokens (jti);

GRANT SELECT, INSERT, UPDATE ON auth_audit_logs TO pos_app;
GRANT SELECT, INSERT, UPDATE ON refresh_tokens TO pos_app;

COMMIT;
