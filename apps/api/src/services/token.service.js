"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const env = require("../config/env");

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

/**
 * Terbitkan pasangan access + refresh token dengan metadata standar.
 * Dipakai oleh email login, dev login, dan PIN login agar formatnya konsisten.
 */
function issueTokens({ userId, merchantId, role, deviceId, sessionId }) {
  const access = buildSignedToken({ userId, merchantId, role, sessionId, tokenType: "access" });
  const refresh = buildSignedToken({ userId, merchantId, role, deviceId, sessionId, tokenType: "refresh" });

  return {
    access_token: access.token,
    refresh_token: refresh.token,
    expires_in: Math.round(parseExpiresIn(env.JWT_ACCESS_EXPIRES_IN) / 1000),
    accessTokenMetadata: access,
    refreshTokenMetadata: refresh,
  };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = {
  parseExpiresIn,
  hashToken,
  buildSignedToken,
  issueTokens,
  verifyAccessToken,
  verifyRefreshToken,
};
