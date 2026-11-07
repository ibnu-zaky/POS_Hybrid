BEGIN;

-- Perbaikan: migrasi 019 menimpa CHECK movement type dan menghapus tipe cnc_*
-- yang dibuat oleh 012b. Kembalikan seluruh tipe yang sah.
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN (
    'sale', 'restock', 'adjustment', 'return', 'void',
    'cnc_reserve', 'cnc_cancel', 'cnc_expire'
  ));

COMMIT;
