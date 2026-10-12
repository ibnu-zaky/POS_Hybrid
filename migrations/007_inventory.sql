BEGIN;

-- Ponytail: tanpa location_id dulu — schema belum punya tabel locations.
-- Upgrade path: tambah kolom location_id + ubah unique constraint saat
-- modul multi-location dibangun.
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0
    CONSTRAINT inventory_quantity_nonnegative CHECK (quantity >= 0),
  reorder_point INTEGER NOT NULL DEFAULT 10
    CONSTRAINT inventory_reorder_point_nonnegative CHECK (reorder_point >= 0),
  unit_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_merchant_sku_unique UNIQUE (merchant_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('sale', 'restock', 'adjustment', 'return')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  reference_id VARCHAR(100),
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_merchant_sku_idx
  ON inventory (merchant_id, sku);

CREATE INDEX IF NOT EXISTS inventory_movements_merchant_sku_idx
  ON inventory_movements (merchant_id, sku, created_at DESC);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_isolation ON inventory;
CREATE POLICY inventory_isolation ON inventory
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_movements_isolation ON inventory_movements;
CREATE POLICY inventory_movements_isolation ON inventory_movements
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO pos_app;
-- Ledger: insert & select saja, tidak boleh diubah/dihapus.
GRANT SELECT, INSERT ON inventory_movements TO pos_app;

COMMIT;
