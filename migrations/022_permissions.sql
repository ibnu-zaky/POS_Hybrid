BEGIN;

-- Tabel permissions per merchant
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  code VARCHAR(128) NOT NULL, -- mis. "transaction:create", "inventory:manage"
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_permissions_merchant ON permissions (merchant_id);

-- Tabel mapping role ke permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  role VARCHAR(64) NOT NULL, -- mis. "admin", "manager", "cashier", "integration"
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_merchant_role ON role_permissions (merchant_id, role);

-- RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_isolation ON permissions;
CREATE POLICY permissions_isolation ON permissions
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS role_permissions_isolation ON role_permissions;
CREATE POLICY role_permissions_isolation ON role_permissions
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON permissions TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO pos_app;

-- Backfill permission dasar untuk semua merchant yang ada
INSERT INTO permissions (merchant_id, code, description)
SELECT m.id, p.code, p.description
FROM merchants m
CROSS JOIN (
  VALUES 
    ('transaction:create', 'Buat transaksi POS'),
    ('transaction:read', 'Lihat transaksi'),
    ('transaction:void', 'Void transaksi'),
    ('inventory:manage', 'Kelola inventaris dan stok'),
    ('admin:manage', 'Kelola staff dan konfigurasi')
) AS p(code, description)
ON CONFLICT (merchant_id, code) DO NOTHING;

-- Backfill role_permissions untuk role default (admin, manager, cashier, integration)
INSERT INTO role_permissions (merchant_id, role, permission_id)
SELECT p.merchant_id, r.role, p.id
FROM permissions p
JOIN (
  VALUES 
    ('admin', 'transaction:create'),
    ('admin', 'transaction:read'),
    ('admin', 'transaction:void'),
    ('admin', 'inventory:manage'),
    ('admin', 'admin:manage'),
    ('manager', 'transaction:create'),
    ('manager', 'transaction:read'),
    ('manager', 'transaction:void'),
    ('manager', 'inventory:manage'),
    ('cashier', 'transaction:create'),
    ('cashier', 'transaction:read'),
    ('integration', 'transaction:create'),
    ('integration', 'transaction:read')
) AS r(role, code) ON p.code = r.code
ON CONFLICT (merchant_id, role, permission_id) DO NOTHING;

COMMIT;
