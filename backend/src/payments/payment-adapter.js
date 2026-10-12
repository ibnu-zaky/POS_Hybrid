class PaymentAdapter {
  async createPayment() { throw new Error("createPayment is not implemented"); }
  async getPayment() { throw new Error("getPayment is not implemented"); }
  async cancelPayment() { throw new Error("cancelPayment is not implemented"); }
  async refundPayment() { throw new Error("refundPayment is not implemented"); }
  verifyWebhook() { throw new Error("verifyWebhook is not implemented"); }
  normalizeWebhook() { throw new Error("normalizeWebhook is not implemented"); }
}

module.exports = PaymentAdapter;