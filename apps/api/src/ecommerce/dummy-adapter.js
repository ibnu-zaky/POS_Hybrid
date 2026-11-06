"use strict";

const crypto = require("crypto");
const EcommerceAdapter = require("./base-adapter");

class DummyAdapter extends EcommerceAdapter {
  constructor(config = {}) {
    super();
    this.storeName = config.store_name || "Dummy Store";
    this.secret = config.api_secret || "dummy-ecommerce-secret";
    this.orders = config.orders || [];
  }

  async fetchOrders({ since } = {}) {
    let filtered = [...this.orders];
    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter((o) => new Date(o.created_at) >= sinceDate);
    }
    return filtered.map((o) => this.normalizeOrder(o));
  }

  async fetchOrder(orderId) {
    const order = this.orders.find((o) => o.marketplace_order_id === orderId);
    if (!order) return null;
    return this.normalizeOrder(order);
  }

  async updateFulfillment(orderId, status, tracking) {
    const order = this.orders.find((o) => o.marketplace_order_id === orderId);
    if (!order) return null;
    order.status = status;
    if (tracking) order.tracking_number = tracking;
    return this.normalizeOrder(order);
  }

  async pushInventory(items) {
    // Dummy: always succeed, return summary
    return { pushed: items.length, marketplace: "dummy" };
  }

  verifyWebhook(payload, signature) {
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(JSON.stringify(payload))
      .digest("hex");
    return signature === expected;
  }

  normalizeWebhook(payload) {
    return {
      marketplace_order_id: payload.marketplace_order_id,
      status: payload.status,
      total: payload.total,
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      shipping_address: payload.shipping_address || null,
      items: payload.items || [],
      raw_payload: payload,
    };
  }

  normalizeOrder(order) {
    return {
      marketplace_order_id: order.marketplace_order_id,
      status: order.status,
      total: order.total,
      customer_name: order.customer_name || null,
      customer_email: order.customer_email || null,
      shipping_address: order.shipping_address || null,
      items: order.items || [],
      raw_payload: order,
      created_at: order.created_at,
    };
  }
}

module.exports = DummyAdapter;
