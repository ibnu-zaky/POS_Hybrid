BEGIN;

-- Tambahkan 'qris' ke daftar payment_method yang valid.
-- Hapus CHECK lama, buat baru.
-- Catatan: ALTER TABLE memerlukan superuser/owner karena mengubah constraint.
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'ewallet', 'bank_transfer', 'qris'));

COMMIT;
