BEGIN;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded', 'voided'));

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check 
  CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'void', 'cnc_reserve', 'cnc_cancel', 'cnc_expire'));

ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

COMMIT;