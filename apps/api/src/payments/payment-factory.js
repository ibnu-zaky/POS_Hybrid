const StripeAdapter = require("./stripe.adapter");
const XenditAdapter = require("./xendit.adapter");
const QrisAdapter = require("./qris.adapter");
const DummyAdapter = require("./dummy.adapter");
const env = require("../config/env");

function getPaymentAdapter(provider) {
  if (env.PAYMENT_MODE === "dummy") return new DummyAdapter();

  try {
    if (provider === "stripe") return new StripeAdapter();
    if (provider === "xendit") return new XenditAdapter();
    if (provider === "qris") return new QrisAdapter();
  } catch (error) {
    error.statusCode = 503;
    throw error;
  }
  throw Object.assign(new Error("Unsupported payment provider"), { statusCode: 400 });
}

module.exports = { getPaymentAdapter };