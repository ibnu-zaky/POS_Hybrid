/**
 * authenticate-oauth.js
 *
 * Middleware yang mendukung dua mode verifikasi token:
 *
 * 1. JWKS mode (jika OAUTH_JWKS_URI dikonfigurasi):
 *    Memverifikasi JWT Bearer token menggunakan JWKS endpoint dari OAuth provider.
 *    Claims yang diambil: sub, merchant_id (custom claim), role (custom claim).
 *    Berguna untuk integrasi dengan Auth0, Keycloak, Google Identity Platform, dsb.
 *
 * 2. Internal JWT mode (default, jika OAUTH_JWKS_URI tidak dikonfigurasi):
 *    Fallback ke authenticate.js yang memverifikasi menggunakan JWT_ACCESS_SECRET.
 *    Ini adalah mode default untuk development dan production tanpa OAuth provider.
 *
 * Cara mengaktifkan JWKS mode:
 *   Set OAUTH_JWKS_URI, OAUTH_ISSUER, OAUTH_AUDIENCE di .env
 *
 * OAuth provider harus menyertakan custom claims:
 *   - merchant_id (UUID merchant)
 *   - role ("admin" | "manager" | "cashier")
 *
 * PENTING: ApiKey scheme (Authorization: ApiKey <key>) selalu didelegasikan ke
 * authenticate.js di kedua mode.
 */

const jwt = require("jsonwebtoken");
const https = require("https");
const env = require("../config/env");
const authenticate = require("./authenticate");

// Cache JWKS in-memory untuk menghindari fetch berulang.
// JWKS biasanya jarang berubah; refresh interval: 1 jam.
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

/**
 * Fetch JWKS dari URI yang dikonfigurasi.
 * Menggunakan cache in-memory dengan TTL 1 jam.
 */
async function fetchJwks() {
  const now = Date.now();

  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL_MS) {
    return jwksCache;
  }

  return new Promise((resolve, reject) => {
    https.get(env.OAUTH_JWKS_URI, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          jwksCache = parsed.keys || [];
          jwksCacheTime = Date.now();
          resolve(jwksCache);
        } catch (parseError) {
          reject(new Error("Failed to parse JWKS response"));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Konversi JWK key ke format PEM yang bisa digunakan jwt.verify.
 * Hanya mendukung RSA keys (RS256/RS384/RS512) yang paling umum dari OAuth providers.
 */
function jwkToPem(jwk) {
  // Node.js 15+ mendukung import JWK langsung via crypto.createPublicKey
  const { createPublicKey } = require("crypto");

  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    return key.export({ type: "spki", format: "pem" });
  } catch (_error) {
    return null;
  }
}

/**
 * Verifikasi JWT menggunakan JWKS.
 * Mencari key yang sesuai dengan `kid` di header token.
 */
async function verifyWithJwks(token) {
  const header = jwt.decode(token, { complete: true })?.header;

  if (!header) {
    throw new Error("Invalid token format");
  }

  const keys = await fetchJwks();

  // Cari key yang sesuai dengan kid di header token.
  // Jika tidak ada kid, gunakan key pertama (beberapa provider tidak menyertakan kid).
  const matchingKey = header.kid
    ? keys.find((k) => k.kid === header.kid)
    : keys[0];

  if (!matchingKey) {
    throw new Error("No matching JWKS key found");
  }

  const pem = jwkToPem(matchingKey);

  if (!pem) {
    throw new Error("Failed to convert JWK to PEM");
  }

  const verifyOptions = {
    algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
  };

  if (env.OAUTH_ISSUER) {
    verifyOptions.issuer = env.OAUTH_ISSUER;
  }

  if (env.OAUTH_AUDIENCE) {
    verifyOptions.audience = env.OAUTH_AUDIENCE;
  }

  return jwt.verify(token, pem, verifyOptions);
}

/**
 * Middleware utama.
 * - ApiKey scheme → selalu delegasi ke authenticate.js
 * - Bearer scheme + JWKS dikonfigurasi → verifikasi via JWKS
 * - Bearer scheme + tanpa JWKS → delegasi ke authenticate.js (JWT internal)
 */
async function authenticateOAuth(request, response, next) {
  const authorization = request.get("Authorization");
  const [scheme] = authorization ? authorization.split(" ") : [];

  // ApiKey tidak melalui OAuth — delegasi langsung
  if (scheme === "ApiKey" || !env.OAUTH_JWKS_URI) {
    return authenticate(request, response, next);
  }

  const token = authorization.split(" ")[1];

  if (scheme !== "Bearer" || !token) {
    return response.status(401).json({ error: "Authentication required" });
  }

  try {
    const claims = await verifyWithJwks(token);

    if (
      typeof claims !== "object" ||
      typeof claims.sub !== "string" ||
      typeof claims.merchant_id !== "string" ||
      typeof claims.role !== "string"
    ) {
      return response.status(401).json({ error: "Invalid OAuth token claims. Ensure merchant_id and role are present." });
    }

    request.auth = {
      sub: claims.sub,
      merchant_id: claims.merchant_id,
      role: claims.role,
      jti: claims.jti,
      sid: claims.sid,
    };

    return next();
  } catch (error) {
    // Jika JWKS gagal (network error dsb.), jangan fallback ke JWT internal
    // untuk menghindari bypass keamanan yang tidak disengaja.
    return response.status(401).json({ error: "Invalid or expired OAuth token" });
  }
}

module.exports = authenticateOAuth;