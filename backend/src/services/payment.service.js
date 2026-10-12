const { withTenantContext, pool } = require("../config/database");
const env = require("../config/env");
const transactionRepository = require("../repositories/transaction.repository");
const paymentRepository = require("../repositories/payment.repository");
const { getPaymentAdapter } = require("../payments/payment-factory");
const { logAuthEvent } = require("./auth.service");
const inventoryService = require("./inventory.service");
const paymentAudit = (eventType, payment, metadata = {}) => logAuthEvent({
  eventType,
  userId: payment?.created_by,
  merchantId: payment?.merchant_id,
  metadata: { payment_id: payment?.id, transaction_id: payment?.transaction_id, provider: payment?.provider, ...metadata },
});

const transitions = {
  pending: new Set(["paid", "failed", "expired"]),
  paid: new Set(["refunded"]),
  failed: new Set(),
  expired: new Set(),
  refunded: new Set(),
};

class PaymentError extends Error {
  constructor(message, statusCode = 400) { super(message); this.name = "PaymentError"; this.statusCode = statusCode; }
}

function assertTransition(current, next) {
  if (current !== next && !transitions[current]?.has(next)) throw new PaymentError(`Invalid payment status transition: ${current} -> ${next}`, 409);
}

async function createPayment({ merchantId, transactionId, provider, paymentMethod, currency, customer }) {
  return withTenantContext(merchantId, async (client) => {
    const transaction = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!transaction) throw new PaymentError("Transaction not found", 404);
    if (["paid", "refunded"].includes(transaction.payment_status)) throw new PaymentError("Transaction is already paid", 409);

    const adapter = getPaymentAdapter(provider);
    const external = await adapter.createPayment({ merchantId, transactionId, amount: Number(transaction.grand_total), currency: currency || env.PAYMENT_DEFAULT_CURRENCY, paymentMethod, customer });
    const effectiveProvider = external.provider || provider;
    const payment = await paymentRepository.create(client, { merchantId, transactionId, provider: effectiveProvider, paymentMethod, amount: external.amount, currency: external.currency, providerPaymentId: external.providerPaymentId, providerReference: external.providerReference, checkoutUrl: external.checkoutUrl, expiresAt: external.expiresAt, metadata: { mode: env.PAYMENT_MODE } });
    await client.query(`UPDATE transactions SET payment_status = 'pending', payment_provider = $1, payment_reference = $2, updated_at = NOW() WHERE id = $3 AND merchant_id = $4`, [effectiveProvider, external.providerReference || external.providerPaymentId, transactionId, merchantId]);
    await paymentAudit("payment_created", payment);
    return payment;
  });
}

async function getPayment({ merchantId, paymentId }) {
  return withTenantContext(merchantId, (client) => paymentRepository.findById(client, merchantId, paymentId));
}

async function cancelPayment({ merchantId, paymentId }) {
  return withTenantContext(merchantId, async (client) => {
    const payment = await paymentRepository.findById(client, merchantId, paymentId);
    if (!payment) throw new PaymentError("Payment not found", 404);
    assertTransition(payment.status, "failed");
    const adapter = getPaymentAdapter(payment.provider);
    await adapter.cancelPayment(payment.provider_payment_id);
    const updated = await paymentRepository.updateStatus(client, payment.id, "failed");
    await client.query(`UPDATE transactions SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`, [payment.transaction_id]);
    await paymentAudit("payment_failed", updated);
    return updated;
  });
}

async function refundPayment({ merchantId, paymentId, amount }) {
  return withTenantContext(merchantId, async (client) => {
    const payment = await paymentRepository.findById(client, merchantId, paymentId);
    if (!payment) throw new PaymentError("Payment not found", 404);
    assertTransition(payment.status, "refunded");
    const adapter = getPaymentAdapter(payment.provider);
    await adapter.refundPayment(payment.provider_payment_id, amount || payment.amount);
    const updated = await paymentRepository.updateStatus(client, payment.id, "refunded");
    await client.query(`UPDATE transactions SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1`, [payment.transaction_id]);

    // Restock hanya untuk refund penuh; refund parsial tidak mengembalikan barang
    // (ceiling: partial refund = uang saja).
    const refundAmount = Number(amount || payment.amount);
    if (refundAmount >= Number(payment.amount)) {
      const items = await transactionRepository.findItemsByTransactionId(client, payment.transaction_id);
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items,
        sign: 1,
        type: "return",
        transactionId: payment.transaction_id,
      });
    }

    await paymentAudit("payment_refunded", updated);
    return updated;
  });
}

async function updatePaymentStatus({ merchantId, paymentId, status, details }) {
  return withTenantContext(merchantId, async (client) => {
    const payment = await paymentRepository.findById(client, merchantId, paymentId);
    if (!payment) throw new PaymentError("Payment not found", 404);
    assertTransition(payment.status, status);
    const updated = await paymentRepository.updateStatus(client, payment.id, status, details);
    await client.query(`UPDATE transactions SET payment_status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $2`, [status, payment.transaction_id]);
    return updated;
  });
}

async function handleWebhook({ provider, rawBody, headers, skipVerification = false }) {
  const adapter = getPaymentAdapter(provider);
  if (!skipVerification && !adapter.verifyWebhook({ rawBody, headers })) {
    await paymentAudit("payment_webhook_rejected", null, { provider });
    throw new PaymentError("Invalid webhook signature", 401);
  }
  let normalized;
  try { normalized = adapter.normalizeWebhook(JSON.parse(rawBody)); } catch (_error) { throw new PaymentError("Invalid webhook payload", 400); }
  if (!normalized.eventId || !normalized.reference) throw new PaymentError("Webhook event is missing required identifiers", 400);

  const lookup = await pool.query("SELECT * FROM public.lookup_payment_webhook($1, $2)", [provider, normalized.reference]);
  const paymentMatch = lookup.rows[0];
  if (!paymentMatch) throw new PaymentError("Payment reference not found", 404);

  return withTenantContext(paymentMatch.merchant_id, async (client) => {
    const event = await paymentRepository.insertWebhook(client, { provider, eventId: normalized.eventId, eventType: normalized.eventType, paymentId: paymentMatch.id, payload: normalized, signatureValid: true });
    if (!event && !skipVerification) return { duplicate: true, status: "ignored" };
    if (Number(paymentMatch.amount) !== Number(normalized.amount) || paymentMatch.currency !== normalized.currency) throw new PaymentError("Webhook amount or currency mismatch", 400);
    assertTransition(paymentMatch.status, normalized.status);
    await paymentRepository.updateStatus(client, paymentMatch.id, normalized.status);
    await paymentRepository.completeWebhook(client, normalized.eventId, provider, normalized.status, paymentMatch.id, paymentMatch.transaction_id, normalized.reference);
    await paymentAudit(normalized.status === "paid" ? "payment_completed" : `payment_${normalized.status}`, paymentMatch, { event_id: normalized.eventId });
    return { duplicate: false, status: normalized.status, paymentId: paymentMatch.id };
  });
}

async function reconcilePayments({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    const candidates = await paymentRepository.listReconciliationCandidates(client, merchantId);
    const expired = [];
    for (const payment of candidates) {
      const updated = await paymentRepository.updateStatus(client, payment.id, "expired");
      await client.query(`UPDATE transactions SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`, [payment.transaction_id]);
      await paymentAudit("payment_expired", updated);
      expired.push(updated);
    }
    return { checked: candidates.length, expired };
  });
}

async function retryWebhook({ merchantId, eventId }) {
  const event = await withTenantContext(merchantId, (client) => paymentRepository.findWebhookEvent(client, merchantId, eventId));
  if (!event) throw new PaymentError("Webhook event not found", 404);
  await withTenantContext(merchantId, (client) => paymentRepository.markWebhookRetry(client, eventId));
  return handleWebhook({ provider: event.provider, rawBody: JSON.stringify(event.payload), headers: {}, skipVerification: true });
}

module.exports = {
  PaymentError, createPayment, getPayment, cancelPayment, refundPayment, handleWebhook,
  reconcilePayments, retryWebhook, assertTransition,
};