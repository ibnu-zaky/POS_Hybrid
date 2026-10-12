"use strict";

/**
 * Request ID middleware — set X-Request-Id untuk tracing & logging.
 */

const crypto = require("crypto");

function requestId(request, response, next) {
  const incoming = request.get("X-Request-Id");
  // Batasi panjang & karakter untuk mencegah header injection
  const safe = incoming && /^[A-Za-z0-9_-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  request.id = safe;
  response.setHeader("X-Request-Id", safe);
  return next();
}

module.exports = requestId;
