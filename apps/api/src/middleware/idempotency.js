const crypto = require("crypto");

// Middleware ini TIDAK menyentuh DB. Ia hanya menghitung hash payload dan
// menempelkan konteks idempotency ke request. Claim + simpan response
// dilakukan di dalam transaksi DB yang sama dengan penjualan (lihat
// transaction.service.createTransaction) supaya atomik dan tidak ada
// jendela "key terkunci tapi penjualan gagal".
function idempotencyMiddleware() {
  return (request, response, next) => {
    const key = request.get("Idempotency-Key");
    if (!key) return next();

    const merchantId = request.auth?.merchant_id;
    if (!merchantId) return response.status(400).json({ error: "Merchant context required" });

    const bodyString = JSON.stringify(request.body);
    const hash = crypto
      .createHash("sha256")
      .update(request.method + request.baseUrl + request.path + bodyString)
      .digest("hex");

    request.idempotency = { key, hash };
    return next();
  };
}

module.exports = idempotencyMiddleware;
