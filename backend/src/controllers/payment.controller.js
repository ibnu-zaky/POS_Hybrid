const paymentService = require("../services/payment.service");
const { createPaymentSchema } = require("../schemas/payment.schema");

async function create(request, response, next) {
  try {
    const body = createPaymentSchema.parse(request.body);
    const payment = await paymentService.createPayment({ merchantId: request.auth.merchant_id, transactionId: request.params.id, ...body, paymentMethod: body.payment_method });
    response.status(201).json({ data: payment });
  } catch (error) { next(error); }
}

async function get(request, response, next) {
  try {
    const payment = await paymentService.getPayment({ merchantId: request.auth.merchant_id, paymentId: request.params.id });
    if (!payment) return response.status(404).json({ error: "Payment not found" });
    response.json({ data: payment });
  } catch (error) { next(error); }
}

async function cancel(request, response, next) {
  try { response.json({ data: await paymentService.cancelPayment({ merchantId: request.auth.merchant_id, paymentId: request.params.id }) }); } catch (error) { next(error); }
}

async function refund(request, response, next) {
  try { response.json({ data: await paymentService.refundPayment({ merchantId: request.auth.merchant_id, paymentId: request.params.id, amount: request.body?.amount }) }); } catch (error) { next(error); }
}

module.exports = { create, get, cancel, refund };