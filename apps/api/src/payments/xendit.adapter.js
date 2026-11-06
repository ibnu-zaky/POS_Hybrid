const env = require("../config/env");
const PaymentAdapter = require("./payment-adapter");

class XenditAdapter extends PaymentAdapter {
  constructor({ provider = "xendit" } = {}) {
    super();
    if (!env.XENDIT_ENABLED || !env.XENDIT_SECRET_KEY) throw new Error("Xendit provider is disabled");
    this.provider = provider;
  }

  async createPayment(input) {
    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: `pos_hybrid:${input.merchantId}:${input.transactionId}`, amount: input.amount, payer_email: input.customer?.email, currency: input.currency, description: `POS transaction ${input.transactionId}` }),
    });
    if (!response.ok) throw new Error(`Xendit payment creation failed: ${response.status}`);
    const data = await response.json();
    return { provider: this.provider, providerPaymentId: data.id, providerReference: data.external_id, status: "pending", amount: input.amount, currency: input.currency, checkoutUrl: data.invoice_url, expiresAt: data.expiry_date || null };
  }

  async getPayment(providerPaymentId) {
    const response = await fetch(`https://api.xendit.co/v2/invoices/${encodeURIComponent(providerPaymentId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64")}` } });
    if (!response.ok) throw new Error(`Xendit payment lookup failed: ${response.status}`);
    return response.json();
  }

  async cancelPayment(providerPaymentId) {
    const response = await fetch(`https://api.xendit.co/invoices/${encodeURIComponent(providerPaymentId)}/expire!`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64")}` } });
    if (!response.ok) throw new Error(`Xendit payment cancellation failed: ${response.status}`);
    return response.json();
  }

  async refundPayment(providerPaymentId, amount) {
    const response = await fetch(env.XENDIT_REFUND_URL || "https://api.xendit.co/refunds", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "X-IDEMPOTENCY-KEY": `refund:${providerPaymentId}:${amount}`,
      },
      body: JSON.stringify({ reference_id: providerPaymentId, amount, currency: "IDR" }),
    });
    if (!response.ok) throw new Error(`Xendit refund failed: ${response.status}`);
    return response.json();
  }

  verifyWebhook({ headers }) {
    return Boolean(env.XENDIT_WEBHOOK_TOKEN && headers["x-callback-token"] === env.XENDIT_WEBHOOK_TOKEN);
  }

  normalizeWebhook(payload) {
    const statusMap = { PAID: "paid", SETTLED: "paid", EXPIRED: "expired", FAILED: "failed" };
    return { eventId: payload.id || payload.external_id, eventType: payload.status || "payment.updated", reference: payload.id || payload.external_id, status: statusMap[String(payload.status || "").toUpperCase()] || "pending", amount: Number(payload.amount || 0), currency: String(payload.currency || "IDR").toUpperCase() };
  }
}

module.exports = XenditAdapter;