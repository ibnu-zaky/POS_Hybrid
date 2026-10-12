-- 012: Click & Collect (Phase 3.2)
-- Reserve inventory → pickup QR verification.

BEGIN;

CREATE TABLE IF NOT EXISTS click_and_collect_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  source_order_id UUID REFERENCES ecommerce_orders(id) ON DELETE SET NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(30),
  reserved_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  pickup_code VARCHAR(8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'picked_up', 'expired', 'cancelled')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  picked_up_at TIMESTAMPTZ,
  picked_up_by UUID REFERENCES staff(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cnc_pickup_code_unique UNIQUE (merchant_id, pickup_code)
);

CREATE INDEX IF NOT EXISTS cnc_merchant_status_idx
  ON click_and_collect_orders (merchant_id, status);

CREATE INDEX IF NOT EXISTS cnc_pending_expiry_idx
  ON click_and_collect_orders (expires_at)
  WHERE status IN ('pending', 'ready');

CREATE INDEX IF NOT EXISTS cnc_merchant_created_idx
  ON click_and_collect_orders (merchant_id, created_at DESC);

ALTER TABLE click_and_collect_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_and_collect_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cnc_isolation ON click_and_collect_orders;
CREATE POLICY cnc_isolation ON click_and_collect_orders
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
ON click_and_collect_orders
TO pos_app;

COMMIT;
