BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'pos_app'
  ) THEN
    CREATE ROLE pos_app LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL
    CHECK (subscription_tier IN ('starter', 'growth', 'pro', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active', 'suspended', 'trial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  api_key_hash VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL
    REFERENCES merchants(id)
    ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL
    CHECK (role IN ('admin', 'cashier', 'manager')),
  password_hash VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_email_unique_idx
  ON merchants (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS staff_merchant_email_unique_idx
  ON staff (merchant_id, LOWER(email));

CREATE INDEX IF NOT EXISTS staff_merchant_id_idx
  ON staff (merchant_id);

CREATE INDEX IF NOT EXISTS staff_merchant_active_idx
  ON staff (merchant_id, is_active);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

ALTER TABLE merchants FORCE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchants_isolation ON merchants;

CREATE POLICY merchants_isolation
ON merchants
USING (
  id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
)
WITH CHECK (
  id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
);

DROP POLICY IF EXISTS staff_isolation ON staff;

CREATE POLICY staff_isolation
ON staff
USING (
  merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
)
WITH CHECK (
  merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE
ON merchants, staff
TO pos_app;

COMMIT;