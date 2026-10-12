const crypto = require("crypto");
const env = require("../config/env");
const PaymentAdapter = require("./payment-adapter");

class DummyAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.provider = "dummy";
  }

  async createPayment(input) {
    const providerPaymentId = `dummy_${crypto.randomUUID()}`;
    return {
      provider: this.provider,
      providerPaymentId,
      providerReference: providerPaymentId,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      checkoutUrl: `/dev/payments/checkout/${providerPaymentId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  async getPayment(providerPaymentId) {
    return { id: providerPaymentId, status: "pending" };
  }

  async cancelPayment(providerPaymentId) {
    return { id: providerPaymentId, status: "failed" };
  }

  async refundPayment(providerPaymentId, amount) {
    return { id: providerPaymentId, status: "refunded", amount };
  }

  verifyWebhook({ headers }) {
    return headers["x-dummy-webhook-secret"] === env.DUMMY_PAYMENT_WEBHOOK_SECRET;
  }

  normalizeWebhook(payload) {
    const status = ["paid", "failed", "expired"].includes(payload.status) ? payload.status : "pending";
    return {
      eventId: payload.event_id,
      eventType: payload.event_type || `dummy.payment.${status}`,
      reference: payload.payment_reference,
      status,
      amount: Number(payload.amount),
      currency: String(payload.currency || env.PAYMENT_DEFAULT_CURRENCY).toUpperCase(),
    };
  }
}

module.exports = DummyAdapter;