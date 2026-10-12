BEGIN;

-- =============================================
-- RLS untuk tabel transactions
-- =============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy berlaku untuk owner tabel juga.
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_isolation ON transactions;

CREATE POLICY transactions_isolation
ON transactions
USING (
  merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
)
WITH CHECK (
  merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
);

-- =============================================
-- RLS untuk tabel transaction_items
-- Isolasi via subquery ke transactions agar
-- tenant_id tidak perlu diduplikasi di sini.
-- =============================================
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE transaction_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transaction_items_isolation ON transaction_items;

CREATE POLICY transaction_items_isolation
ON transaction_items
USING (
  transaction_id IN (
    SELECT id
    FROM transactions
    WHERE merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
  )
)
WITH CHECK (
  transaction_id IN (
    SELECT id
    FROM transactions
    WHERE merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::uuid
  )
);

COMMIT;