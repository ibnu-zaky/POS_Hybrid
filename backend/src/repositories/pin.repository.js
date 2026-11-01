"use strict";

const { pool, withTenantContext } = require("../config/database");

// Repository PIN + device pairing.
// Lookup unauthenticated (merchant by code/id, staff by pin, device pair by token)
// memakai fungsi SECURITY DEFINER di migration 018 — RLS memblokir query langsung
// ke merchants/staff/device_pairs saat app.merchant_id belum di-set (saat login PIN).
// Sisanya (update lockout, pairing CRUD) tetap perlu withTenantContext.

async function findMerchantByCode(code) {
  const result = await pool.query(
    "SELECT * FROM public.lookup_merchant_by_code($1)",
    [code],
  );
  return result.rows[0] || null;
}

async function findMerchantById(merchantId) {
  const result = await pool.query(
    "SELECT * FROM public.lookup_merchant_by_id($1)",
    [merchantId],
  );
  return result.rows[0] || null;
}

async function setMerchantCode(merchantId, code) {
  const result = await pool.query(
    `UPDATE merchants SET code = $2 WHERE id = $1 RETURNING id, name, code`,
    [merchantId, code],
  );
  return result.rows[0] || null;
}

// Ambil staff beserta kolom PIN (untuk verifikasi + lockout).
async function findStaffForPinLogin(merchantId, { staffId, email }) {
  const result = await pool.query(
    "SELECT * FROM public.lookup_staff_for_pin($1, $2, $3)",
    [merchantId, staffId || null, email || null],
  );
  return result.rows[0] || null;
}

async function incrementPinFailure(merchantId, staffId, lockUntilIso) {
  await pool.query(
    `UPDATE staff
     SET pin_failed_count = pin_failed_count + 1,
         pin_locked_until = COALESCE($3, pin_locked_until)
     WHERE merchant_id = $1 AND id = $2`,
    [merchantId, staffId, lockUntilIso || null],
  );
}

async function resetPinFailures(merchantId, staffId) {
  await pool.query(
    `UPDATE staff SET pin_failed_count = 0, pin_locked_until = NULL
     WHERE merchant_id = $1 AND id = $2`,
    [merchantId, staffId],
  );
}

async function setPinHash(merchantId, staffId, pinHash) {
  const result = await pool.query(
    `UPDATE staff SET pin_hash = $3, pin_failed_count = 0, pin_locked_until = NULL
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, merchant_id, email, name, role, is_active`,
    [merchantId, staffId, pinHash],
  );
  return result.rows[0] || null;
}

// ============================================================
// Device pairing
// ============================================================

// Write ke device_pairs butuh GUC tenant aktif agar lulus RLS WITH CHECK.
async function createDevicePair({ merchantId, pairingCode, deviceLabel, tokenHash, createdBy, expiresAtIso }) {
  return withTenantContext(merchantId, async (client) => {
    const result = await client.query(
      `INSERT INTO device_pairs (merchant_id, pairing_code, device_label, device_token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, merchant_id, pairing_code, device_label, created_at, expires_at`,
      [merchantId, pairingCode, deviceLabel || null, tokenHash, createdBy || null, expiresAtIso],
    );
    return result.rows[0];
  });
}

async function redeemDevicePair({ pairingCode, tokenHash }) {
  // SECURITY DEFINER: merchant belum diketahui sebelum UPDATE, jadi tanpa tenant context.
  const result = await pool.query(
    "SELECT * FROM public.redeem_device_pair($1, $2)",
    [pairingCode, tokenHash],
  );
  return result.rows[0] || null;
}

async function findDevicePairByTokenHash(tokenHash) {
  const result = await pool.query(
    "SELECT * FROM public.lookup_device_pair_by_token($1)",
    [tokenHash],
  );
  return result.rows[0] || null;
}

async function revokeDevicePairs(merchantId) {
  const result = await pool.query(
    `UPDATE device_pairs SET revoked_at = NOW()
     WHERE merchant_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [merchantId],
  );
  return result.rowCount;
}

async function listDevicePairs(merchantId) {
  const result = await pool.query(
    `SELECT id, device_label, used_at, revoked_at, expires_at, created_at
     FROM device_pairs
     WHERE merchant_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [merchantId],
  );
  return result.rows;
}

module.exports = {
  findMerchantByCode,
  findMerchantById,
  setMerchantCode,
  findStaffForPinLogin,
  incrementPinFailure,
  resetPinFailures,
  setPinHash,
  createDevicePair,
  redeemDevicePair,
  findDevicePairByTokenHash,
  revokeDevicePairs,
  listDevicePairs,
};
