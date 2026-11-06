const { verifyAccessToken } = require("../services/auth.service");
const { verifyApiKey } = require("../services/apikey.service");

async function authenticate(request, response, next) {
  const authorization = request.get("Authorization");
  const [scheme, token] = authorization ? authorization.split(" ") : [];

  if (!token || !["Bearer", "ApiKey"].includes(scheme)) {
    return response.status(401).json({ error: "Authentication required" });
  }

  try {
    if (scheme === "ApiKey") {
      const claims = await verifyApiKey(token);
      if (!claims) return response.status(401).json({ error: "Invalid or expired API key" });
      request.auth = claims;
      return next();
    }

    const claims = verifyAccessToken(token);

    if (
      typeof claims !== "object" ||
      typeof claims.sub !== "string" ||
      typeof claims.merchant_id !== "string" ||
      typeof claims.role !== "string"
    ) {
      return response.status(401).json({ error: "Invalid access token claims" });
    }

    request.auth = claims;
    return next();
  } catch (_error) {
    return response.status(401).json({ error: "Invalid or expired access token" });
  }
}

module.exports = authenticate;
