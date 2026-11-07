async function listByMerchant(client, { merchantId, limit, offset }) {
  const result = await client.query(
        `SELECT id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount, grand_total,
          amount_paid, change_amount, payment_method, payment_status, payment_provider, payment_reference,
          paid_at, notes, idempotency_key, source, order_type, table_id, table_number, customer_name,
          fulfillment_status, reject_reason, daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at
     FROM transactions
     WHERE merchant_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [merchantId, limit, offset],
  );

  return result.rows;
}

async function countByMerchant(client, merchantId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM transactions
     WHERE merchant_id = $1`,
    [merchantId],
  );

  return result.rows[0]?.total || 0;
}

async function findById(client, { merchantId, transactionId }) {
  const result = await client.query(
        `SELECT id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount, grand_total,
          amount_paid, change_amount, payment_method, payment_status, payment_provider, payment_reference,
          paid_at, notes, idempotency_key, source, order_type, table_id, table_number, customer_name,
          fulfillment_status, reject_reason, daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at
     FROM transactions
     WHERE id = $1 AND merchant_id = $2
     LIMIT 1`,
    [transactionId, merchantId],
  );

  return result.rows[0] || null;
}

async function findItemsByTransactionId(client, transactionId) {
  const result = await client.query(
    `SELECT id, transaction_id, menu_item_id, product_id, product_name, sku, quantity, unit_price, discount_amount,
            line_total, note, created_at
     FROM transaction_items
     WHERE transaction_id = $1
     ORDER BY created_at ASC`,
    [transactionId],
  );

  return result.rows;
}

async function findByIdempotencyKey(client, { merchantId, idempotencyKey }) {
  const result = await client.query(
        `SELECT id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount, grand_total,
          amount_paid, change_amount, payment_method, payment_status, payment_provider, payment_reference,
          paid_at, notes, idempotency_key, source, order_type, table_id, table_number, customer_name,
          fulfillment_status, reject_reason, daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at
     FROM transactions
     WHERE merchant_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [merchantId, idempotencyKey],
  );

  return result.rows[0] || null;
}

async function getMenuItemsForOrder(client, { merchantId, menuItemIds }) {
  const result = await client.query(
    `SELECT id, name, price, sku, is_available, is_active, track_stock
     FROM menu_items
     WHERE merchant_id = $1 AND id = ANY($2::uuid[])
     FOR SHARE`,
    [merchantId, menuItemIds],
  );
  return result.rows;
}

async function findTableForOrder(client, { merchantId, tableId }) {
  const result = await client.query(
    `SELECT id, number
     FROM dining_tables
     WHERE merchant_id = $1 AND id = $2 AND is_active = true
     FOR SHARE`,
    [merchantId, tableId],
  );
  return result.rows[0] || null;
}

async function getNextDailyNumber(client, merchantId) {
  const result = await client.query(
    `INSERT INTO order_counters (merchant_id, counter_date, last_number)
     VALUES ($1, (NOW() AT TIME ZONE 'Asia/Jakarta')::date, 1)
     ON CONFLICT (merchant_id, counter_date)
     DO UPDATE SET last_number = order_counters.last_number + 1
     RETURNING last_number, counter_date::text AS counter_date`,
    [merchantId],
  );
  return result.rows[0];
}

async function create(client, payload) {
  const result = await client.query(
    `INSERT INTO transactions (
       merchant_id, staff_id, order_number, status, subtotal, discount_amount, tax_amount, grand_total,
       amount_paid, change_amount, payment_method, notes, idempotency_key, source, order_type, table_id,
       table_number, customer_name, fulfillment_status, daily_number, daily_date, discount_pct, tax_pct, public_token, payment_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
     RETURNING id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount,
               grand_total, amount_paid, change_amount, payment_method, payment_status, notes, idempotency_key,
               source, order_type, table_id, table_number, customer_name, fulfillment_status, reject_reason,
               daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at`,
    [
      payload.merchant_id,
      payload.staff_id,
      payload.order_number,
      payload.status,
      payload.subtotal,
      payload.discount_amount,
      payload.tax_amount,
      payload.grand_total,
      payload.amount_paid,
      payload.change_amount,
      payload.payment_method,
      payload.notes || null,
      payload.idempotency_key || null,
      payload.source,
      payload.order_type,
      payload.table_id || null,
      payload.table_number ?? null,
      payload.customer_name || null,
      payload.fulfillment_status,
      payload.daily_number,
      payload.daily_date,
      payload.discount_pct,
      payload.tax_pct,
      payload.public_token || null,
      payload.payment_status,
    ],
  );

  return result.rows[0];
}

async function insertItems(client, transactionId, items) {
  if (!items || !items.length) {
    return [];
  }

  const values = items.map((item, index) => {
    const startIndex = index * 10 + 1;
    return `($${startIndex}, $${startIndex + 1}, $${startIndex + 2}, $${startIndex + 3}, $${startIndex + 4}, $${startIndex + 5}, $${startIndex + 6}, $${startIndex + 7}, $${startIndex + 8}, $${startIndex + 9})`;
  });

  const flatValues = items.flatMap((item) => [
    transactionId,
    item.menu_item_id || null,
    item.product_id || null,
    item.product_name || "Item",
    item.sku || null,
    Number(item.quantity || 0),
    Number(item.unit_price || 0),
    Number(item.discount_amount || 0),
    Number(item.line_total || 0),
    item.note || null,
  ]);

  const query = `
    INSERT INTO transaction_items (
      transaction_id, menu_item_id, product_id, product_name, sku, quantity, unit_price, discount_amount, line_total, note
    ) VALUES ${values.join(", ")}
    RETURNING *
  `;

  const result = await client.query(query, flatValues);
  return result.rows;
}

async function replaceItems(client, transactionId, items) {
  await client.query(`DELETE FROM transaction_items WHERE transaction_id = $1`, [transactionId]);
  return insertItems(client, transactionId, items);
}

async function update(client, { merchantId, transactionId, updates }) {
  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  });

  if (!fields.length) {
    return findById(client, { merchantId, transactionId });
  }

  values.push(transactionId, merchantId);
  const result = await client.query(
    `UPDATE transactions
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${index} AND merchant_id = $${index + 1}
    RETURNING id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount,
        grand_total, amount_paid, change_amount, payment_method, payment_status, payment_provider,
        payment_reference, paid_at, notes, source, order_type, table_id, table_number, customer_name,
        fulfillment_status, reject_reason, daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at`,
    values,
  );

  return result.rows[0] || null;
}

async function markVoided(client, { merchantId, transactionId, reason }) {
  const result = await client.query(
    `UPDATE transactions
     SET status = 'voided', voided_at = NOW(), void_reason = $1, updated_at = NOW()
     WHERE id = $2 AND merchant_id = $3
     RETURNING id, voided_at, void_reason`,
    [reason, transactionId, merchantId],
  );

  return result.rows[0] || null;
}

async function remove(client, { merchantId, transactionId }) {
  await client.query(`DELETE FROM transaction_items WHERE transaction_id = $1`, [transactionId]);
  const result = await client.query(
    `DELETE FROM transactions WHERE id = $1 AND merchant_id = $2 RETURNING id`,
    [transactionId, merchantId],
  );

  return result.rowCount > 0;
}

module.exports = {
  listByMerchant,
  countByMerchant,
  findById,
  findByIdempotencyKey,
  getMenuItemsForOrder,
  findTableForOrder,
  getNextDailyNumber,
  findItemsByTransactionId,
  create,
  insertItems,
  replaceItems,
  update,
  remove,
  markVoided,
};
