BEGIN;

-- 1. Tabel menu_item_variants
CREATE TABLE IF NOT EXISTS menu_item_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sku VARCHAR(100),
  price_override INTEGER NOT NULL CHECK (price_override >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, menu_item_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_menu_item ON menu_item_variants (menu_item_id);

-- 2. Tambah kolom variant_id ke transaction_items untuk snapshot
ALTER TABLE transaction_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES menu_item_variants(id) ON DELETE SET NULL;

-- 3. RLS untuk menu_item_variants
ALTER TABLE menu_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_variants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_item_variants_isolation ON menu_item_variants;
CREATE POLICY menu_item_variants_isolation ON menu_item_variants
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_item_variants TO pos_app;

COMMIT;
