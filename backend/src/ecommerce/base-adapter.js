"use strict";

class EcommerceAdapter {
  async fetchOrders() { throw new Error("fetchOrders is not implemented"); }
  async fetchOrder() { throw new Error("fetchOrder is not implemented"); }
  async updateFulfillment() { throw new Error("updateFulfillment is not implemented"); }
  async pushInventory() { throw new Error("pushInventory is not implemented"); }
  verifyWebhook() { throw new Error("verifyWebhook is not implemented"); }
  normalizeWebhook() { throw new Error("normalizeWebhook is not implemented"); }
}

module.exports = EcommerceAdapter;
