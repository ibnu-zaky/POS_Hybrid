const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const idempotencyRepository = require("../repositories/idempotency.repository");

function idempotencyMiddleware() {
  return async (request, response, next) => {
    const key = request.get("Idempotency-Key");
    if (!key) return next();

    const merchantId = request.auth?.merchant_id;
    if (!merchantId) return response.status(400).json({ error: "Merchant context required" });

    const bodyString = JSON.stringify(request.body);
    const hash = crypto.createHash("sha256")
      .update(request.method + request.baseUrl + request.path + bodyString)
      .digest("hex");

    try {
      const { row: existing, claimed } = await withTenantContext(merchantId, async (client) => {
        return idempotencyRepository.claim(client, { merchantId, key, hash });
      });

      if (!claimed) {
        if (existing.request_hash !== hash) {
          return response.status(422).json({
            error: "IDEMPOTENCY_PAYLOAD_MISMATCH",
            message: "Idempotency key already used with different payload"
          });
        }
        return response.status(existing.response_status || 200).json({
          ...existing.response_body,
          replayed: true
        });
      }

      const originalJson = response.json.bind(response);
      response.json = function(body) {
        withTenantContext(merchantId, async (client) => {
          await idempotencyRepository.complete(client, { merchantId, key, status: response.statusCode, body });
        }).catch(() => {});
        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = idempotencyMiddleware;