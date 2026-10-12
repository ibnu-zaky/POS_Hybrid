-- 010: Advanced Analytics (Phase 2.1)
-- View agregat harian dengan security_invoker=true:
-- ketika pos_app query view, RLS pada transactions/transaction_items
-- tetap berlaku (isolasi tenant by design, tanpa matview + refresh).

BEGIN;

CREATE OR REPLACE VIEW v_daily_sales
WITH (security_invoker = true) AS
SELECT
  t.merchant_id,
  (t.created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
  ti.sku,
  ti.product_name,
  SUM(ti.quantity)::int AS quantity,
  SUM(ti.line_total)::float AS revenue
FROM transactions t
JOIN transaction_items ti ON ti.transaction_id = t.id
WHERE t.status = 'completed'
GROUP BY
  t.merchant_id,
  (t.created_at AT TIME ZONE 'Asia/Jakarta')::date,
  ti.sku,
  ti.product_name;

GRANT SELECT ON v_daily_sales TO pos_app;

COMMIT;
