-- 011: E-Commerce Connector (Phase 3.1)
-- Tabel connections, orders, order_items untuk integrasi marketplace.

BEGIN;

CREATE TABLE IF NOT EXISTS ecommerce_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  marketplace VARCHAR(30) NOT NULL
    CHECK (marketplace IN ('tokopedia', 'shopee', 'woocommerce', 'dummy')),
  store_name VARCHAR(100) NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ecommerce_conn_merchant_store_unique UNIQUE (merchant_id, store_name)
);

CREATE INDEX IF NOT EXISTS ecommerce_conn_merchant_idx
  ON ecommerce_connections (merchant_id);

CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES ecommerce_connections(id) ON DELETE CASCADE,
  marketplace_order_id VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded')),
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  customer_name VARCHAR(200),
  customer_email VARCHAR(255),
  shipping_address JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ecommerce_order_conn_marketplace_unique UNIQUE (connection_id, marketplace_order_id)
);

CREATE INDEX IF NOT EXISTS ecommerce_order_merchant_status_idx
  ON ecommerce_orders (merchant_id, status);

CREATE INDEX IF NOT EXISTS ecommerce_order_merchant_date_idx
  ON ecommerce_orders (merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ecommerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecommerce_order_id UUID NOT NULL REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
    CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ecommerce_order_items_order_idx
  ON ecommerce_order_items (ecommerce_order_id);

ALTER TABLE ecommerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE ecommerce_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ecommerce_connections_isolation ON ecommerce_connections;
CREATE POLICY ecommerce_connections_isolation ON ecommerce_connections
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS ecommerce_orders_isolation ON ecommerce_orders;
CREATE POLICY ecommerce_orders_isolation ON ecommerce_orders
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

DROP POLICY IF EXISTS ecommerce_order_items_isolation ON ecommerce_order_items;
CREATE POLICY ecommerce_order_items_isolation ON ecommerce_order_items
  USING (EXISTS (
    SELECT 1 FROM ecommerce_orders eo
    WHERE eo.id = ecommerce_order_id
      AND eo.merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
  ));

GRANT SELECT, INSERT, UPDATE, DELETE
ON ecommerce_connections, ecommerce_orders, ecommerce_order_items
TO pos_app;

COMMIT;
