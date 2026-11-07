BEGIN;

-- Tambah status 'voided' ke transaksi
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check 
  CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded', 'voided'));

-- Tambah movement type 'void' ke inventory_movements
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check 
  CHECK (type IN ('sale', 'restock', 'adjustment', 'return', 'void'));

-- Tambah audit columns untuk void bila belum ada
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

COMMIT;
