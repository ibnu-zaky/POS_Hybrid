"use strict";

const express = require("express");

const authenticate = require("../middleware/authenticate");
const tenantContext = require("../middleware/tenant-context");
const authorize = require("../middleware/authorize");
const { createRateLimiter } = require("../middleware/rate-limit");
const env = require("../config/env");
const authController = require("../controllers/auth.controller");
const pinController = require("../controllers/pin.controller");

const router = express.Router();

// Rate limit khusus untuk PIN login (brute-force protection).
// forceInTest = true agar test bisa menguji rate limit secara eksplisit.
const pinLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_PIN_MAX,
  keyGenerator: (req) => `${req.ip}:${req.body?.device_id || req.body?.merchant_code || "unknown"}`,
  forceInTest: true,
});

router.post("/pin-login", pinLimiter, pinController.pinLogin);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticate, tenantContext, authController.logout);
router.get("/me", authenticate, tenantContext, authController.me);

// Device pairing: admin login dulu, lalu buat kode → tablet tukar kode → dapat device_token.
router.post(
  "/pairing",
  authenticate,
  authorize(["admin"]),
  pinController.createPairing,
);
router.post("/pairing/redeem", pinController.redeemPairing);
router.get(
  "/pairing",
  authenticate,
  authorize(["admin"]),
  pinController.listPairings,
);
router.delete(
  "/pairing",
  authenticate,
  authorize(["admin"]),
  pinController.revokePairings,
);

module.exports = router;
