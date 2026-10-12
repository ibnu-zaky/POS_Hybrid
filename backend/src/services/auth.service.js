const crypto = require("crypto");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

const env = require("../config/env");
const { pool, withTenantContext } = require("../config/database");
const staffRepository = require("../repositories/staff.repository");
const merchantRepository = require("../repositories/merchant.repository");

const authAuditLogs = [];
const refreshTokens = new Map();

class AuthenticationError extends Error {
  constructor(message = "Invalid credentials") {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = 401;
  }
}

function parseExpiresIn(value) {
  const normalized = String(value || "15m").trim().toLowerCase();
  const match = normalized.match(/^(\d+)([smhd])$/);

  if (!match) {
    return 15 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.m);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

async function logAuthEvent({ eventType, userId, merchantId, deviceId, ipAddress, userAgent, metadata = {} }) {
  const auditRecord = {
    id: crypto.randomUUID(),
    event_type: eventType,
    user_id: userId || null,
    merchant_id: merchantId || null,
    device_id: deviceId || null,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    metadata,
    created_at: new Date().toISOString(),
  };

  authAuditLogs.push(auditRecord);

  try {
    if (pool && typeof pool.query === "function") {
      await pool.query(
        `INSERT INTO auth_audit_logs (id, event_type, user_id, merchant_id, device_id, ip_address, user_agent, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          auditRecord.id,
          auditRecord.event_type,
          auditRecord.user_id,
          auditRecord.merchant_id,
          auditRecord.device_id,
          auditRecord.ip_address,
          auditRecord.user_agent,
          JSON.stringify(auditRecord.metadata || {}),
        ],
      );
    }
  } catch (_error) {
    // Keep app working in development even when the migration is not yet granted.
  }
}

async function storeRefreshToken({ userId, merchantId, role, deviceId, refreshToken, expiresAt, jti, sessionId }) {
  const tokenHash = hashToken(refreshToken);
  const finalSessionId = sessionId || crypto.randomUUID();
  const tokenEntry = {
    id: crypto.randomUUID(),
    user_id: userId,
    merchant_id: merchantId,
    role,
    session_id: finalSessionId,
    device_id: deviceId || null,
    token_hash: tokenHash,
    jti: jti || tokenHash,
    expires_at: expiresAt,
    created_at: new Date(),
    revoked_at: null,
  };

  refreshTokens.set(tokenEntry.jti, tokenEntry);

  try {
    if (pool && typeof pool.query === "function") {
      await pool.query(
        `INSERT INTO refresh_tokens (id, user_id, merchant_id, role, session_id, device_id, token_hash, jti, expires_at, created_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NULL)
         ON CONFLICT (jti) DO UPDATE SET
           token_hash = EXCLUDED.token_hash,
           session_id = EXCLUDED.session_id,
           expires_at = EXCLUDED.expires_at,
           revoked_at = NULL`,
        [
          tokenEntry.id,
          tokenEntry.user_id,
          tokenEntry.merchant_id,
          tokenEntry.role,
          tokenEntry.session_id,
          tokenEntry.device_id,
          tokenEntry.token_hash,
          tokenEntry.jti,
          tokenEntry.expires_at,
        ],
      );
    }
  } catch (_error) {
    // Development fallback: keep in-memory rotation active while database table is not yet granted.
  }
}

function buildSignedToken({ userId, merchantId, role, deviceId, sessionId, tokenType }) {
  const secret = tokenType === "refresh" ? env.JWT_REFRESH_SECRET : env.JWT_ACCESS_SECRET;
  const expiresIn = tokenType === "refresh" ? env.JWT_REFRESH_EXPIRES_IN : env.JWT_ACCESS_EXPIRES_IN;
  const jti = crypto.randomUUID();
  const sid = sessionId || crypto.randomUUID();
  const claims = {
    sub: userId,
    merchant_id: merchantId,
    role,
    jti,
    sid,
    token_type: tokenType,
  };

  if (deviceId) {
    claims.device_id = deviceId;
  }

  return {
    jti,
    sid,
    token: jwt.sign(claims, secret, { expiresIn }),
    expiresAt: new Date(Date.now() + parseExpiresIn(expiresIn)),
  };
}

function buildAuthResponse({ userId, merchantId, role, email, name, merchantName, deviceId, ipAddress, userAgent, sessionId }) {
  const accessToken = buildSignedToken({ userId, merchantId, role, sessionId, tokenType: "access" });
  const refreshToken = buildSignedToken({ userId, merchantId, role, deviceId, sessionId, tokenType: "refresh" });

  return {
    token_type: "Bearer",
    access_token: accessToken.token,
    refresh_token: refreshToken.token,
    expires_in: Math.round(parseExpiresIn(env.JWT_ACCESS_EXPIRES_IN) / 1000),
    staff: {
      id: userId,
      name,
      email,
      role,
    },
    merchant: {
      id: merchantId,
      name: merchantName,
    },
    accessTokenMetadata: accessToken,
    refreshTokenMetadata: refreshToken,
    ipAddress,
    userAgent,
  };
}

async function login({ email, password, deviceId, merchantId, ipAddress, userAgent }) {
  const result = await withTenantContext(merchantId, async (client) => {
    const [staff, merchant] = await Promise.all([
      staffRepository.findByEmail(client, email),
      merchantRepository.findById(client, merchantId),
    ]);

    if (!staff || !merchant || !staff.is_active || merchant.status === "suspended") {
      throw new AuthenticationError();
    }

    let passwordMatches = false;
    if (staff.password_hash) {
      try {
        passwordMatches = await argon2.verify(staff.password_hash, password);
      } catch (_error) {
        passwordMatches = false;
      }
    }

    if (!passwordMatches || staff.merchant_id !== merchant.id) {
      throw new AuthenticationError();
    }

    return { staff, merchant };
  });

  const responsePayload = buildAuthResponse({
    userId: result.staff.id,
    merchantId: result.merchant.id,
    role: result.staff.role,
    email: result.staff.email,
    name: result.staff.name,
    merchantName: result.merchant.name,
    deviceId,
    ipAddress,
    userAgent,
  });

  await storeRefreshToken({
    userId: result.staff.id,
    merchantId: result.merchant.id,
    role: result.staff.role,
    deviceId,
    refreshToken: responsePayload.refresh_token,
    expiresAt: responsePayload.refreshTokenMetadata.expiresAt,
    jti: responsePayload.refreshTokenMetadata.jti,
    sessionId: responsePayload.refreshTokenMetadata.sid,
  });

  await logAuthEvent({
    eventType: "login",
    userId: result.staff.id,
    merchantId: result.merchant.id,
    deviceId,
    ipAddress,
    userAgent,
    metadata: { role: result.staff.role },
  });

  return {
    token_type: "Bearer",
    access_token: responsePayload.access_token,
    refresh_token: responsePayload.refresh_token,
    expires_in: responsePayload.expires_in,
    staff: responsePayload.staff,
    merchant: responsePayload.merchant,
  };
}

async function loginDev({ email, password, deviceId, merchantId, ipAddress, userAgent }) {
  if (env.NODE_ENV === "production" || !env.ALLOW_DEV_LOGIN) {
    throw new AuthenticationError("Development login is disabled");
  }

  const trimmedEmail = String(email || "").trim().toLowerCase();
  const expectedEmail = String(env.DEV_LOGIN_EMAIL || "admin@dev.local").trim().toLowerCase();
  const expectedPassword = String(env.DEV_LOGIN_PASSWORD || "devpassword123");

  if (trimmedEmail !== expectedEmail || password !== expectedPassword) {
    throw new AuthenticationError();
  }

  const fakeId = "00000000-0000-0000-0000-000000000001";
  const fakeName = "Developer Test User";

  const responsePayload = buildAuthResponse({
    userId: fakeId,
    merchantId,
    role: "admin",
    email: trimmedEmail,
    name: fakeName,
    merchantName: "Development Tenant",
    deviceId,
    ipAddress,
    userAgent,
    sessionId: crypto.randomUUID(),
  });

  await storeRefreshToken({
    userId: fakeId,
    merchantId,
    role: "admin",
    deviceId,
    refreshToken: responsePayload.refresh_token,
    expiresAt: responsePayload.refreshTokenMetadata.expiresAt,
    jti: responsePayload.refreshTokenMetadata.jti,
    sessionId: responsePayload.refreshTokenMetadata.sid,
  });

  await logAuthEvent({
    eventType: "dev_login",
    userId: fakeId,
    merchantId,
    deviceId,
    ipAddress,
    userAgent,
    metadata: { email: trimmedEmail },
  });

  return {
    token_type: "Bearer",
    access_token: responsePayload.access_token,
    refresh_token: responsePayload.refresh_token,
    expires_in: responsePayload.expires_in,
    staff: {
      id: fakeId,
      name: fakeName,
      email: trimmedEmail,
      role: "admin",
    },
    merchant: {
      id: merchantId,
      name: "Development Tenant",
    },
  };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

async function refreshSession({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) {
    throw new AuthenticationError("Refresh token is required");
  }

  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const existingToken = [...refreshTokens.values()].find(
    (tokenEntry) =>
      tokenEntry.user_id === claims.sub &&
      tokenEntry.merchant_id === claims.merchant_id &&
      tokenEntry.session_id === claims.sid &&
      tokenEntry.jti === claims.jti &&
      tokenEntry.token_hash === tokenHash &&
      !tokenEntry.revoked_at &&
      new Date(tokenEntry.expires_at) > new Date(),
  );

  if (!existingToken) {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  existingToken.revoked_at = new Date();

  const refreshedSession = buildAuthResponse({
    userId: claims.sub,
    merchantId: claims.merchant_id,
    role: claims.role,
    email: "",
    name: "",
    merchantName: "",
    deviceId: claims.device_id,
    ipAddress,
    userAgent,
    sessionId: claims.sid,
  });

  await storeRefreshToken({
    userId: claims.sub,
    merchantId: claims.merchant_id,
    role: claims.role,
    deviceId: claims.device_id,
    refreshToken: refreshedSession.refresh_token,
    expiresAt: refreshedSession.refreshTokenMetadata.expiresAt,
    jti: refreshedSession.refreshTokenMetadata.jti,
    sessionId: claims.sid,
  });

  await logAuthEvent({
    eventType: "token_refresh",
    userId: claims.sub,
    merchantId: claims.merchant_id,
    deviceId: claims.device_id,
    ipAddress,
    userAgent,
    metadata: {
      refresh_jti: claims.jti,
      session_id: claims.sid,
      rotated_to_jti: refreshedSession.refreshTokenMetadata.jti,
    },
  });

  return {
    token_type: "Bearer",
    access_token: refreshedSession.access_token,
    refresh_token: refreshedSession.refresh_token,
    expires_in: refreshedSession.expires_in,
  };
}

async function logout({ userId, merchantId, refreshToken, ipAddress, userAgent }) {
  if (refreshToken) {
    try {
      const claims = verifyRefreshToken(refreshToken);
      for (const token of refreshTokens.values()) {
        if (
          token.user_id === claims.sub &&
          token.merchant_id === claims.merchant_id &&
          token.session_id === claims.sid &&
          !token.revoked_at
        ) {
          token.revoked_at = new Date();
        }
      }
    } catch (_error) {
      // Do not expose invalid token details; still continue to revoke by user if present.
    }
  }

  if (userId && merchantId) {
    for (const token of refreshTokens.values()) {
      if (token.user_id === userId && token.merchant_id === merchantId && !token.revoked_at) {
        token.revoked_at = new Date();
      }
    }
  }

  if (userId && merchantId) {
    await logAuthEvent({
      eventType: "logout",
      userId,
      merchantId,
      deviceId: null,
      ipAddress,
      userAgent,
      metadata: { revoked_by_user: true },
    });
  }

  return { success: true };
}

module.exports = {
  AuthenticationError,
  logAuthEvent,
  login,
  loginDev,
  logout,
  refreshSession,
  verifyAccessToken,
  verifyRefreshToken,
};
