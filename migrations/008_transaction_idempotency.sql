-- 008: Idempotency key untuk transaksi (Phase 1.5 — Offline Transaction Support)
-- Client offline mengirim key unik; retry akan mengembalikan transaksi yang sama,
-- bukan membuat duplikat.

BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_idempotency_key_idx
  ON transactions (merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
