const crypto = require("crypto");
const env = require("../config/env");
const PaymentAdapter = require("./payment-adapter");

function formBody(values) {
  return new URLSearchParams(values).toString();
}

class StripeAdapter extends PaymentAdapter {
  constructor() {
    super();
    if (!env.STRIPE_ENABLED || !env.STRIPE_SECRET_KEY) throw new Error("Stripe provider is disabled");
  }

  async createPayment(input) {
    const idempotencyKey = `pos:${input.merchantId}:${input.transactionId}`;
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idempotencyKey },
      body: formBody({ amount: Math.round(input.amount), currency: input.currency.toLowerCase(), "metadata[transaction_id]": input.transactionId, "metadata[merchant_id]": input.merchantId }),
    });
    if (!response.ok) throw new Error(`Stripe payment creation failed: ${response.status}`);
    const data = await response.json();
    return { provider: "stripe", providerPaymentId: data.id, providerReference: data.id, status: data.status === "succeeded" ? "paid" : "pending", amount: input.amount, currency: input.currency, checkoutUrl: null, expiresAt: null };
  }

  async getPayment(providerPaymentId) {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(providerPaymentId)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    if (!response.ok) throw new Error(`Stripe payment lookup failed: ${response.status}`);
    return response.json();
  }

  async cancelPayment(providerPaymentId) {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(providerPaymentId)}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    if (!response.ok) throw new Error(`Stripe payment cancellation failed: ${response.status}`);
    return response.json();
  }

  async refundPayment(providerPaymentId, amount) {
    const response = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: formBody({ payment_intent: providerPaymentId, amount: Math.round(amount) }) });
    if (!response.ok) throw new Error(`Stripe refund failed: ${response.status}`);
    return response.json();
  }

  verifyWebhook({ rawBody, headers }) {
    const signature = headers["stripe-signature"];
    if (!signature || !env.STRIPE_WEBHOOK_SECRET) return false;
    const timestamp = signature.match(/t=(\d+)/)?.[1];
    const received = signature.match(/v1=([a-f0-9]+)/)?.[1];
    if (!timestamp || !received || Math.abs(Date.now() / 1000 - Number(timestamp)) > env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS) return false;
    const expected = crypto.createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  normalizeWebhook(payload) {
    const object = payload.data?.object || {};
    const status = payload.type === "payment_intent.succeeded" ? "paid" : payload.type === "payment_intent.payment_failed" ? "failed" : "pending";
    return { eventId: payload.id, eventType: payload.type, reference: object.id, status, amount: Number(object.amount || 0), currency: String(object.currency || "").toUpperCase() };
  }
}

module.exports = StripeAdapter;