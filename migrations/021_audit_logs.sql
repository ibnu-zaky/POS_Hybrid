BEGIN;

-- Rename auth_audit_logs to audit_logs (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_audit_logs') THEN
        ALTER TABLE auth_audit_logs RENAME TO audit_logs;
    ELSEIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
            event_type VARCHAR(64) NOT NULL,
            actor_id UUID,
            actor_role VARCHAR(32),
            resource_type VARCHAR(64),
            resource_id UUID,
            metadata JSONB,
            ip_address INET,
            user_agent TEXT,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            device_id VARCHAR(128)
        );
    END IF;
END $$;

-- Add columns if missing (idempotent)
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(128);

-- Backfill occurred_at and received_at from created_at if exists
UPDATE audit_logs
SET occurred_at = COALESCE(created_at, NOW()),
    received_at = COALESCE(created_at, NOW())
WHERE occurred_at IS NULL OR received_at IS NULL;

-- Remove created_at if it exists (we use occurred_at now)
ALTER TABLE audit_logs DROP COLUMN IF EXISTS created_at;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_occurred ON audit_logs (merchant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
CREATE POLICY audit_logs_isolation ON audit_logs
    USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
    WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

-- Revoke UPDATE, DELETE, TRUNCATE from application role
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM pos_app;
-- Grant only SELECT and INSERT
GRANT SELECT, INSERT ON audit_logs TO pos_app;

COMMIT;