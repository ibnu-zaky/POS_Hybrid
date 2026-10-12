async function listByMerchant(client, { merchantId, limit, offset }) {
  const result = await client.query(
        `SELECT id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount, grand_total,
          amount_paid, change_amount, payment_method, payment_status, payment_provider, payment_reference,
          paid_at, notes, idempotency_key, created_at, updated_at
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
          paid_at, notes, idempotency_key, created_at, updated_at
     FROM transactions
     WHERE id = $1 AND merchant_id = $2
     LIMIT 1`,
    [transactionId, merchantId],
  );

  return result.rows[0] || null;
}

async function findItemsByTransactionId(client, transactionId) {
  const result = await client.query(
    `SELECT id, transaction_id, product_id, product_name, sku, quantity, unit_price, discount_amount,
            line_total, created_at
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
          paid_at, notes, idempotency_key, created_at, updated_at
     FROM transactions
     WHERE merchant_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [merchantId, idempotencyKey],
  );

  return result.rows[0] || null;
}

async function create(client, payload) {
  const result = await client.query(
    `INSERT INTO transactions (
       merchant_id, staff_id, order_number, status, subtotal, discount_amount, tax_amount, grand_total,
       amount_paid, change_amount, payment_method, notes, idempotency_key
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount,
               grand_total, amount_paid, change_amount, payment_method, notes, idempotency_key, created_at, updated_at`,
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
    ],
  );

  return result.rows[0];
}

async function insertItems(client, transactionId, items) {
  if (!items || !items.length) {
    return [];
  }

  const values = items.map((item, index) => {
    const startIndex = index * 8 + 1;
    return `($${startIndex}, $${startIndex + 1}, $${startIndex + 2}, $${startIndex + 3}, $${startIndex + 4}, $${startIndex + 5}, $${startIndex + 6}, $${startIndex + 7})`;
  });

  const flatValues = items.flatMap((item) => [
    transactionId,
    item.product_id || null,
    item.product_name || "Item",
    item.sku || null,
    Number(item.quantity || 0),
    Number(item.unit_price || 0),
    Number(item.discount_amount || 0),
    Number(item.line_total || 0),
  ]);

  const query = `
    INSERT INTO transaction_items (
      transaction_id, product_id, product_name, sku, quantity, unit_price, discount_amount, line_total
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
        payment_reference, paid_at, notes, created_at, updated_at`,
    values,
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
  findItemsByTransactionId,
  create,
  insertItems,
  replaceItems,
  update,
  remove,
};
