BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(30),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_merchant_lower_name_idx
  ON categories (merchant_id, LOWER(name));

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  track_stock BOOLEAN NOT NULL DEFAULT FALSE,
  sku VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  number INT NOT NULL,
  token VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (merchant_id, number),
  UNIQUE (token)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_isolation ON categories;
CREATE POLICY categories_isolation ON categories
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_items_isolation ON menu_items;
CREATE POLICY menu_items_isolation ON menu_items
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

ALTER TABLE dining_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_tables FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dining_tables_isolation ON dining_tables;
CREATE POLICY dining_tables_isolation ON dining_tables
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_items TO pos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON dining_tables TO pos_app;

DROP FUNCTION IF EXISTS public.lookup_table_by_token(VARCHAR);
CREATE FUNCTION public.lookup_table_by_token(p_token VARCHAR)
RETURNS TABLE(merchant_id UUID, table_id UUID, number INT)
AS $$
SELECT dt.merchant_id, dt.id AS table_id, dt.number
FROM public.dining_tables AS dt
WHERE dt.token = p_token;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_table_by_token(VARCHAR) TO pos_app;

COMMIT;