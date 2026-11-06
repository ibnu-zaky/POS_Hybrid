async function findById(client, merchantId, paymentId) {
  const result = await client.query(`SELECT * FROM payments WHERE id = $1 AND merchant_id = $2 LIMIT 1`, [paymentId, merchantId]);
  return result.rows[0] || null;
}

async function findByReference(client, provider, reference) {
  const result = await client.query(`SELECT * FROM payments WHERE provider = $1 AND (provider_payment_id = $2 OR provider_reference = $2) LIMIT 1`, [provider, reference]);
  return result.rows[0] || null;
}

async function create(client, input) {
  const result = await client.query(
    `INSERT INTO payments (merchant_id, transaction_id, provider, payment_method, amount, currency, provider_payment_id, provider_reference, checkout_url, expires_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [input.merchantId, input.transactionId, input.provider, input.paymentMethod, input.amount, input.currency, input.providerPaymentId, input.providerReference, input.checkoutUrl, input.expiresAt, JSON.stringify(input.metadata || {})],
  );
  return result.rows[0];
}

async function updateStatus(client, paymentId, status, details = {}) {
  const result = await client.query(
    `UPDATE payments SET status = $2::varchar, paid_at = CASE WHEN $2::varchar = 'paid' THEN NOW() ELSE paid_at END,
       failure_code = $3, failure_message = $4, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [paymentId, status, details.failureCode || null, details.failureMessage || null],
  );
  return result.rows[0] || null;
}

async function insertWebhook(client, event) {
  const result = await client.query(
    `INSERT INTO payment_webhook_events (provider, event_id, event_type, payment_id, payload, signature_valid)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider, event_id) DO NOTHING RETURNING *`,
    [event.provider, event.eventId, event.eventType, event.paymentId || null, JSON.stringify(event.payload || {}), event.signatureValid],
  );
  return result.rows[0] || null;
}

async function completeWebhook(client, eventId, provider, status, paymentId, transactionId, reference) {
  await client.query(`UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = NOW(), payment_id = $1 WHERE provider = $2 AND event_id = $3`, [paymentId, provider, eventId]);
  await client.query(`UPDATE transactions SET payment_status = $1::varchar, payment_provider = $2::varchar, payment_reference = $3::varchar, paid_at = CASE WHEN $1::varchar = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $4::uuid`, [status, provider, reference, transactionId]);
}

async function listReconciliationCandidates(client, merchantId) {
  const result = await client.query(
    `SELECT id, transaction_id, provider, status, amount, currency, provider_payment_id,
            provider_reference, expires_at, updated_at
     FROM payments
     WHERE merchant_id = $1 AND status = 'pending'
       AND (expires_at IS NULL OR expires_at <= NOW())
     ORDER BY updated_at ASC`,
    [merchantId],
  );
  return result.rows;
}

async function findWebhookEvent(client, merchantId, eventId) {
  const result = await client.query(
    `SELECT e.* FROM payment_webhook_events e
     JOIN payments p ON p.id = e.payment_id
     WHERE p.merchant_id = $1 AND e.id = $2 LIMIT 1`,
    [merchantId, eventId],
  );
  return result.rows[0] || null;
}

async function markWebhookRetry(client, eventId) {
  await client.query(
    `UPDATE payment_webhook_events
     SET processing_status = 'received', error_message = NULL, processed_at = NULL
     WHERE id = $1`,
    [eventId],
  );
}

module.exports = {
  findById, findByReference, create, updateStatus, insertWebhook, completeWebhook,
  listReconciliationCandidates, findWebhookEvent, markWebhookRetry,
};