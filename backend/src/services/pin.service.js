"use strict";

const crypto = require("crypto");
const argon2 = require("argon2");

const pinRepository = require("../repositories/pin.repository");
const authService = require("./auth.service");
const { AuthenticationError } = authService;
const tokenService = require("./token.service");

const PIN_MAX_LENGTH = 6;
const PIN_MIN_LENGTH = 4;
const PIN_LOCKOUT_THRESHOLD = 5;
const PIN_LOCKOUT_MINUTES = 5;
const PIN_LOCKOUT_MS = PIN_LOCKOUT_MINUTES * 60 * 1000;

function normalizeCode(code) {
  return String(code || "").trim().toLowerCase();
}

function generatePairingCode() {
  // Kode 8 karakter, mudah diketik di tablet (tanpa karakter ambigu).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

function hashDeviceToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isValidPin(pin) {
  const p = String(pin || "");
  return /^\d+$/.test(p) && p.length >= PIN_MIN_LENGTH && p.length <= PIN_MAX_LENGTH;
}

async function resolveTenant({ merchantCode, deviceToken }) {
  if (deviceToken) {
    const pair = await pinRepository.findDevicePairByTokenHash(hashDeviceToken(deviceToken));
    if (!pair) {
      throw new AuthenticationError("Perangkat tidak dikenali. Lakukan pairing ulang.");
    }
    const merchant = await pinRepository.findMerchantById(pair.merchant_id);
    if (!merchant || merchant.status === "suspended") {
      throw new AuthenticationError("Toko tidak aktif.");
    }
    return { merchantId: merchant.id, merchant, deviceLabel: pair.device_label };
  }

  if (merchantCode) {
    const merchant = await pinRepository.findMerchantByCode(normalizeCode(merchantCode));
    if (!merchant || merchant.status === "suspended") {
      throw new AuthenticationError("Kode toko tidak ditemukan.");
    }
    return { merchantId: merchant.id, merchant, deviceLabel: null };
  }

  throw new AuthenticationError();
}

async function pinLogin({ merchantCode, deviceToken, staffId, email, pin, deviceId, ipAddress, userAgent }) {
  if (!isValidPin(pin)) {
    throw new AuthenticationError("PIN harus 4-6 digit.");
  }

  const { merchantId, merchant, deviceLabel } = await resolveTenant({ merchantCode, deviceToken });

  const staff = await pinRepository.findStaffForPinLogin(merchantId, { staffId, email });
  if (!staff || !staff.is_active) {
    throw new AuthenticationError();
  }

  // Lockout aktif?
  if (staff.pin_locked_until && new Date(staff.pin_locked_until) > new Date()) {
    const remainingMs = new Date(staff.pin_locked_until) - new Date();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new AuthenticationError(
      `Terlalu banyak percobaan gagal. Coba lagi dalam ${remainingMin} menit.`,
    );
  }

  let pinMatches = false;
  if (staff.pin_hash) {
    try {
      pinMatches = await argon2.verify(staff.pin_hash, String(pin));
    } catch (_error) {
      pinMatches = false;
    }
  }

  if (!pinMatches) {
    const newCount = (staff.pin_failed_count || 0) + 1;
    let lockUntil = null;
    if (newCount >= PIN_LOCKOUT_THRESHOLD) {
      lockUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
    }
    await pinRepository.incrementPinFailure(merchantId, staff.id, lockUntil);

    // Pesan generik — jangan bocorkan apakah PIN-nya salah atau staff-nya ada.
    if (lockUntil) {
      throw new AuthenticationError(
        `Terlalu banyak percobaan gagal. Akun terkunci ${PIN_LOCKOUT_MINUTES} menit.`,
      );
    }
    throw new AuthenticationError("PIN salah.");
  }

  // PIN benar → reset counter gagal.
  await pinRepository.resetPinFailures(merchantId, staff.id);

  const tokens = tokenService.issueTokens({
    userId: staff.id,
    merchantId: merchant.id,
    role: staff.role,
    deviceId,
  });

  // Persist refresh token + audit trail (sama seperti email login).
  await authService.storeRefreshToken({
    userId: staff.id,
    merchantId: merchant.id,
    role: staff.role,
    deviceId,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.refreshTokenMetadata.expiresAt,
    jti: tokens.refreshTokenMetadata.jti,
    sessionId: tokens.refreshTokenMetadata.sid,
  });

  await authService.logAuthEvent({
    eventType: "pin_login",
    userId: staff.id,
    merchantId: merchant.id,
    deviceId,
    ipAddress,
    userAgent,
    metadata: { role: staff.role, device_label: deviceLabel },
  });

  return {
    token_type: "Bearer",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    },
    merchant: {
      id: merchant.id,
      name: merchant.name,
      code: merchant.code,
    },
    device_label: deviceLabel,
  };
}

// ============================================================
// Device pairing
// ============================================================

async function createPairing({ merchantId, deviceLabel, ttlMinutes }) {
  const pairingCode = generatePairingCode();
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashDeviceToken(token);
  const expiresAtIso = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await pinRepository.createDevicePair({
    merchantId,
    pairingCode,
    deviceLabel,
    tokenHash,
    createdBy: null,
    expiresAtIso,
  });

  return {
    pairing_code: pairingCode,
    device_token: token,
    expires_at: expiresAtIso,
  };
}

async function redeemPairing({ pairingCode, deviceId }) {
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashDeviceToken(token);

  const pair = await pinRepository.redeemDevicePair({ pairingCode: normalizeCode(pairingCode), tokenHash });
  if (!pair) {
    throw new AuthenticationError("Kode pairing tidak valid atau kedaluwarsa.");
  }

  const merchant = await pinRepository.findMerchantById(pair.merchant_id);
  return {
    merchant_id: merchant.id,
    merchant_name: merchant.name,
    merchant_code: merchant.code,
    device_token: token,
    device_label: pair.device_label,
  };
}

module.exports = {
  pinLogin,
  createPairing,
  redeemPairing,
  isValidPin,
  PIN_LOCKOUT_THRESHOLD,
  PIN_LOCKOUT_MINUTES,
};
