-- 012b: Extend inventory_movements type untuk Click & Collect

BEGIN;

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'cnc_reserve', 'cnc_cancel', 'cnc_expire'));

COMMIT;
