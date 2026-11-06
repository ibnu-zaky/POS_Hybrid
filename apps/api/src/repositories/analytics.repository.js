"use strict";

async function salesByProduct(client, { merchantId, from, to, limit }) {
  const result = await client.query(
    `SELECT v.sku, v.product_name,
            SUM(v.quantity)::int AS quantity,
            SUM(v.revenue)::float AS revenue
     FROM v_daily_sales v
     WHERE v.merchant_id = $1
       AND v.day >= $2::date
       AND v.day <= $3::date
     GROUP BY v.sku, v.product_name
     ORDER BY revenue DESC, quantity DESC
     LIMIT $4`,
    [merchantId, from, to, limit],
  );

  return result.rows;
}

async function marginByProduct(client, { merchantId, from, to, limit }) {
  const result = await client.query(
    `SELECT v.sku, v.product_name,
            SUM(v.quantity)::int AS quantity,
            SUM(v.revenue)::float AS revenue,
            ROUND(SUM(v.quantity * COALESCE(i.unit_cost, 0))::numeric, 2)::float AS estimated_cogs,
            ROUND(((SUM(v.revenue) - SUM(v.quantity * COALESCE(i.unit_cost, 0)))
              / NULLIF(SUM(v.revenue), 0))::numeric, 4)::float AS margin_ratio,
            (i.unit_cost IS NOT NULL) AS has_cost
     FROM v_daily_sales v
     LEFT JOIN inventory i
       ON i.merchant_id = v.merchant_id AND i.sku = v.sku
     WHERE v.merchant_id = $1
       AND v.day >= $2::date
       AND v.day <= $3::date
       AND v.sku IS NOT NULL
     GROUP BY v.sku, v.product_name, i.unit_cost
     ORDER BY (SUM(v.revenue) - SUM(v.quantity * COALESCE(i.unit_cost, 0))) DESC
     LIMIT $4`,
    [merchantId, from, to, limit],
  );

  return result.rows;
}

async function slowMovingSkus(client, { merchantId, referenceDate, days, limit }) {
  const result = await client.query(
    `SELECT i.sku, i.product_name, i.quantity, i.reorder_point, i.unit_cost
     FROM inventory i
     WHERE i.merchant_id = $1
       AND i.sku NOT IN (
         SELECT DISTINCT v.sku
         FROM v_daily_sales v
         WHERE v.merchant_id = $1
           AND v.sku IS NOT NULL
           AND v.day > ($2::date - $3::int)
           AND v.day <= $2::date
       )
     ORDER BY i.quantity DESC, i.sku ASC
     LIMIT $4`,
    [merchantId, referenceDate, days, limit],
  );

  return result.rows;
}

async function turnoverByProduct(client, { merchantId, from, to, limit }) {
  const result = await client.query(
    `SELECT v.sku, v.product_name,
            SUM(v.quantity)::int AS sold_quantity,
            ROUND(SUM(v.quantity * COALESCE(i.unit_cost, 0))::numeric, 2)::float AS estimated_cogs,
            i.quantity AS current_stock,
            ROUND((SUM(v.quantity)::numeric / NULLIF(i.quantity, 0))::numeric, 4)::float AS turnover_ratio
     FROM v_daily_sales v
     JOIN inventory i
       ON i.merchant_id = v.merchant_id AND i.sku = v.sku
     WHERE v.merchant_id = $1
       AND v.day >= $2::date
       AND v.day <= $3::date
       AND v.sku IS NOT NULL
     GROUP BY v.sku, v.product_name, i.quantity
     ORDER BY turnover_ratio DESC NULLS LAST
     LIMIT $4`,
    [merchantId, from, to, limit],
  );

  return result.rows;
}

module.exports = {
  salesByProduct,
  marginByProduct,
  slowMovingSkus,
  turnoverByProduct,
};
