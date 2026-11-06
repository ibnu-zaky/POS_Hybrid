"use strict";

const pinService = require("../services/pin.service");
const {
  pinLoginSchema,
  createPairingSchema,
  redeemPairingSchema,
} = require("../schemas/pin.schema");

async function pinLogin(request, response, next) {
  try {
    let body;
    try {
      body = pinLoginSchema.parse(request.body);
    } catch (_validationError) {
      // Semua upaya kredensial yang tidak valid (termasuk PIN bukan digit)
      // dibalas 401 agar tidak membocorkan perbedaan format vs kesalahan kredensial.
      return response.status(401).json({ error: "PIN salah" });
    }

    const result = await pinService.pinLogin({
      merchantCode: body.merchant_code,
      deviceToken: body.device_token,
      staffId: body.staff_id,
      email: body.email,
      pin: body.pin,
      deviceId: body.device_id,
      ipAddress: request.ip,
      userAgent: request.get("User-Agent"),
    });

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function createPairing(request, response, next) {
  try {
    const body = createPairingSchema.parse(request.body || {});

    const result = await pinService.createPairing({
      merchantId: request.auth.merchant_id,
      deviceLabel: body.device_label,
      ttlMinutes: body.ttl_minutes,
    });

    response.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function redeemPairing(request, response, next) {
  try {
    const body = redeemPairingSchema.parse(request.body);

    const result = await pinService.redeemPairing({
      pairingCode: body.pairing_code,
      deviceId: body.device_id,
    });

    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function listPairings(request, response, next) {
  try {
    const pinRepository = require("../repositories/pin.repository");
    const data = await pinRepository.listDevicePairs(request.auth.merchant_id);
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

async function revokePairings(request, response, next) {
  try {
    const pinRepository = require("../repositories/pin.repository");
    const revoked = await pinRepository.revokeDevicePairs(request.auth.merchant_id);
    response.status(200).json({ data: { revoked } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  pinLogin,
  createPairing,
  redeemPairing,
  listPairings,
  revokePairings,
};
