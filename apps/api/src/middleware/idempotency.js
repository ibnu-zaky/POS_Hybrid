const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const idempotencyRepository = require("../repositories/idempotency.repository");
const { claim, complete } = idempotencyRepository;

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
        return claim(client, { merchantId, key, hash });
      });
      
      if (!claimed) {
        if (existing.request_hash !== hash) {
          return response.status(422).json({
            error: "IDEMPOTENCY_PAYLOAD_MISMATCH",
            message: "Idempotency key already used with different payload"
          });
        }
        // Request pertama masih berjalan (response belum tersimpan)
        if (existing.response_status === 0) {
          return response.status(409).json({ error: "IDEMPOTENCY_IN_PROGRESS" });
        }
        // Replay selalu 200 + replayed:true
        return response.status(200).json({
          ...existing.response_body,
          replayed: true
        });
      }

      const originalJson = response.json.bind(response);
      response.json = function(body) {
        if (response.statusCode < 400) {
          withTenantContext(merchantId, async (client) => {
            await complete(client, { merchantId, key, status: response.statusCode, body });
          }).catch((e) => console.error("complete err", e));
        } else {
          // Gagal: lepas key supaya retry boleh
          withTenantContext(merchantId, async (client) => {
            await client.query("DELETE FROM idempotency_keys WHERE merchant_id = $1 AND key = $2", [merchantId, key]);
          }).catch((e) => console.error("cleanup err", e));
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = idempotencyMiddleware;
