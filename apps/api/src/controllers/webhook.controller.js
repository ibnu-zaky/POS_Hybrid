const paymentService = require("../services/payment.service");

async function completion(request, response, next) {
  try {
    const provider = request.get("X-Payment-Provider") || request.query.provider;
    if (!["stripe", "xendit", "qris", "dummy"].includes(provider)) return response.status(400).json({ error: "Payment provider is required" });
    const rawBody = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : JSON.stringify(request.body || {});
    const result = await paymentService.handleWebhook({ provider, rawBody, headers: request.headers });
    return response.status(200).json({ data: result });
  } catch (error) { return next(error); }
}

module.exports = { completion };