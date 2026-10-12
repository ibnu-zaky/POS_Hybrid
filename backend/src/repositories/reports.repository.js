"use strict";

const RANGE_WHERE = `
  WHERE t.merchant_id = $1
    AND t.status = 'completed'
    AND t.created_at >= $2::timestamptz
    AND t.created_at < $3::timestamptz`;

async function summaryByRange(client, { merchantId, from, to }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS transactions_count,
            COALESCE(SUM(t.grand_total), 0)::float AS total_sales,
            COALESCE(AVG(t.grand_total), 0)::float AS average_ticket
     FROM transactions t
     ${RANGE_WHERE}`,
    [merchantId, from, to],
  );

  return result.rows[0] || { transactions_count: 0, total_sales: 0, average_ticket: 0 };
}

async function paymentBreakdownByRange(client, { merchantId, from, to }) {
  const result = await client.query(
    `SELECT t.payment_method,
            COALESCE(SUM(t.grand_total), 0)::float AS total,
            COUNT(*)::int AS count
     FROM transactions t
     ${RANGE_WHERE}
     GROUP BY t.payment_method
     ORDER BY total DESC`,
    [merchantId, from, to],
  );

  return result.rows;
}

async function topProductsByRange(client, { merchantId, from, to, limit = 10 }) {
  const result = await client.query(
    `SELECT ti.product_name,
            ti.sku,
            SUM(ti.quantity)::int AS quantity,
            SUM(ti.line_total)::float AS revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     ${RANGE_WHERE}
     GROUP BY ti.product_name, ti.sku
     ORDER BY revenue DESC, quantity DESC
     LIMIT $4`,
    [merchantId, from, to, limit],
  );

  return result.rows;
}

async function hourlySalesByRange(client, { merchantId, from, to }) {
  const result = await client.query(
    `SELECT EXTRACT(HOUR FROM t.created_at AT TIME ZONE 'Asia/Jakarta')::int AS hour,
            COALESCE(SUM(t.grand_total), 0)::float AS sales,
            COUNT(*)::int AS transactions
     FROM transactions t
     ${RANGE_WHERE}
     GROUP BY 1
     ORDER BY 1`,
    [merchantId, from, to],
  );

  return result.rows;
}

async function dailySeriesByRange(client, { merchantId, from, to }) {
  const result = await client.query(
    `SELECT TO_CHAR(date_trunc('day', t.created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS day,
            COALESCE(SUM(t.grand_total), 0)::float AS sales,
            COUNT(*)::int AS transactions
     FROM transactions t
     ${RANGE_WHERE}
     GROUP BY 1
     ORDER BY 1`,
    [merchantId, from, to],
  );

  return result.rows;
}

module.exports = {
  summaryByRange,
  paymentBreakdownByRange,
  topProductsByRange,
  hourlySalesByRange,
  dailySeriesByRange,
};
