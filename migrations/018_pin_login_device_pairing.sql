BEGIN;

-- Phase F: Login PIN + device pairing
-- PIN 4-6 digit disimpan sebagai argon2 hash (sama seperti password_hash).
-- Lockout: 5 kali gagal -> terkunci 5 menit.

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pin_failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS code VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_code ON merchants (code) WHERE code IS NOT NULL;

-- Pasangan perangkat: admin membuat kode pairing sekali, tablet menukarnya jadi device token.
CREATE TABLE IF NOT EXISTS device_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  pairing_code VARCHAR(32) NOT NULL,
  device_label VARCHAR(255),
  device_token_hash VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_pairs_code ON device_pairs (pairing_code);
CREATE INDEX IF NOT EXISTS idx_device_pairs_merchant ON device_pairs (merchant_id);

ALTER TABLE device_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_pairs FORCE ROW LEVEL SECURITY;

-- NULL-safe: tanpa NULLIF, cast ''::UUID gagal (22P02) saat app.merchant_id belum di-set
-- (mis. redeemPairing, lookup device pair by token).
DROP POLICY IF EXISTS device_pairs_isolation ON device_pairs;
CREATE POLICY device_pairs_isolation ON device_pairs
  USING (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::UUID)
  WITH CHECK (merchant_id = NULLIF(current_setting('app.merchant_id', true), '')::UUID);

GRANT SELECT, INSERT, UPDATE ON device_pairs TO pos_app;

-- SECURITY DEFINER: lookup tanpa tenant context (saat login PIN, merchant_id belum diketahui).
DROP FUNCTION IF EXISTS public.lookup_merchant_by_code(VARCHAR);
CREATE FUNCTION public.lookup_merchant_by_code(p_code VARCHAR)
RETURNS TABLE(id UUID, name VARCHAR, status VARCHAR, code VARCHAR)
AS $$
SELECT m.id, m.name, m.status, m.code
FROM public.merchants AS m
WHERE m.code = p_code;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_merchant_by_code(VARCHAR) TO pos_app;

DROP FUNCTION IF EXISTS public.lookup_merchant_by_id(UUID);
CREATE FUNCTION public.lookup_merchant_by_id(p_id UUID)
RETURNS TABLE(id UUID, name VARCHAR, status VARCHAR, code VARCHAR)
AS $$
SELECT m.id, m.name, m.status, m.code
FROM public.merchants AS m
WHERE m.id = p_id;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_merchant_by_id(UUID) TO pos_app;

DROP FUNCTION IF EXISTS public.lookup_staff_for_pin(UUID, UUID, VARCHAR);
CREATE FUNCTION public.lookup_staff_for_pin(
  p_merchant_id UUID,
  p_staff_id UUID,
  p_email VARCHAR
)
RETURNS TABLE(
  id UUID, merchant_id UUID, email VARCHAR, name VARCHAR, role VARCHAR,
  is_active BOOLEAN, pin_hash VARCHAR, pin_failed_count INT, pin_locked_until TIMESTAMPTZ
)
AS $$
SELECT s.id, s.merchant_id, s.email, s.name, s.role,
       s.is_active, s.pin_hash, s.pin_failed_count, s.pin_locked_until
FROM public.staff AS s
WHERE s.merchant_id = p_merchant_id
  AND (
    (p_staff_id IS NOT NULL AND s.id = p_staff_id)
    OR (p_staff_id IS NULL AND LOWER(s.email) = LOWER(p_email))
  )
LIMIT 1;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_staff_for_pin(UUID, UUID, VARCHAR) TO pos_app;

DROP FUNCTION IF EXISTS public.lookup_device_pair_by_token(VARCHAR);
CREATE FUNCTION public.lookup_device_pair_by_token(p_token_hash VARCHAR)
RETURNS TABLE(id UUID, merchant_id UUID, device_label VARCHAR, used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
AS $$
SELECT dp.id, dp.merchant_id, dp.device_label, dp.used_at, dp.revoked_at, dp.expires_at
FROM public.device_pairs AS dp
WHERE dp.device_token_hash = p_token_hash
  AND dp.used_at IS NOT NULL AND dp.revoked_at IS NULL;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_device_pair_by_token(VARCHAR) TO pos_app;

-- Redeem: tukar kode pairing jadi device token (sekali pakai). SECURITY DEFINER
-- karena merchant belum diketahui sebelum UPDATE (dipanggil tanpa tenant context).
CREATE OR REPLACE FUNCTION public.redeem_device_pair(
  p_pairing_code VARCHAR,
  p_device_token_hash VARCHAR
) RETURNS TABLE (id UUID, merchant_id UUID, device_label VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.device_pairs AS dp
  SET used_at = NOW(), device_token_hash = p_device_token_hash
  WHERE dp.pairing_code = p_pairing_code
    AND dp.used_at IS NULL
    AND dp.revoked_at IS NULL
    AND dp.expires_at > NOW()
  RETURNING dp.id, dp.merchant_id, dp.device_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_device_pair(VARCHAR, VARCHAR) TO pos_app;

COMMIT;
