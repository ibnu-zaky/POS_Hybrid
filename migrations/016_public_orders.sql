BEGIN;

-- Lookup pesanan QR oleh public token (pelanggan tanpa JWT / tanpa tenant context).
-- SECURITY DEFINER agar pos_app bisa membaca tanpa set app.merchant_id,
-- tetapi akses dibatasi hanya oleh public_token yang acak & unguessable.
DROP FUNCTION IF EXISTS public.lookup_order_by_public_token(UUID, VARCHAR);
CREATE FUNCTION public.lookup_order_by_public_token(p_id UUID, p_token VARCHAR)
RETURNS TABLE(
  id UUID,
  merchant_id UUID,
  order_number VARCHAR,
  status VARCHAR,
  fulfillment_status VARCHAR,
  reject_reason TEXT
)
AS $$
SELECT t.id, t.merchant_id, t.order_number, t.status, t.fulfillment_status, t.reject_reason
FROM public.transactions AS t
WHERE t.id = p_id AND t.public_token = p_token;
$$
LANGUAGE SQL SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.lookup_order_by_public_token(UUID, VARCHAR) TO pos_app;

COMMIT;
