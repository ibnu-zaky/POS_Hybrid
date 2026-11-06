const crypto = require("crypto");
const { pool, withTenantContext } = require("../config/database");
const env = require("../config/env");

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function generateApiKey({ merchantId, staffId, name, expiresAt }) {
  const rawKey = `${env.API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  const prefix = rawKey.slice(0, Math.min(rawKey.length, 16));
  const createdBy = staffId && !String(staffId).startsWith("00000000-") ? staffId : null;
  const result = await withTenantContext(merchantId, async (client) => {
    const query = await client.query(
      `INSERT INTO api_keys (merchant_id, key_hash, key_prefix, name, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, key_prefix, name, expires_at, created_at`,
      [merchantId, hashKey(rawKey), prefix, name, expiresAt || null, createdBy],
    );
    return query.rows[0];
  });
  return { ...result, key: rawKey };
}

async function verifyApiKey(rawKey) {
  if (!rawKey) return null;
  const result = await pool.query("SELECT * FROM public.lookup_api_key($1)", [hashKey(rawKey)]);
  const key = result.rows[0];
  if (!key) return null;
  await pool.query("SELECT public.touch_api_key($1)", [key.id]);
  return { sub: key.created_by || `api-key:${key.id}`, merchant_id: key.merchant_id, role: "integration", api_key_id: key.id };
}

async function listApiKeys({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    const result = await client.query(
      `SELECT id, key_prefix, name, last_used_at, expires_at, revoked_at, created_by, created_at
       FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId],
    );
    return result.rows;
  });
}

async function revokeApiKey({ merchantId, keyId }) {
  return withTenantContext(merchantId, async (client) => {
    const result = await client.query(
      `UPDATE api_keys SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = $1 AND merchant_id = $2 RETURNING id, revoked_at`,
      [keyId, merchantId],
    );
    return result.rows[0] || null;
  });
}

module.exports = { generateApiKey, verifyApiKey, listApiKeys, revokeApiKey, hashKey };