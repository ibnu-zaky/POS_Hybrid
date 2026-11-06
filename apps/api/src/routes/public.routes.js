"use strict";

const express = require("express");
const publicController = require("../controllers/public.controller");
const { createRateLimiter } = require("../middleware/rate-limit");
const env = require("../config/env");

const router = express.Router();

// Rate limit lebih ketat untuk endpoint publik — per IP + per token meja
// agar satu meja yang di-spam tetap terbatas walau IP berbeda (VPN/hotspot).
const publicLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_PUBLIC_MAX || 10,
  keyGenerator: (req) => {
    const token = req.params?.token || req.query?.pt || "-";
    return `${req.ip || req.socket?.remoteAddress || "unknown"}:${token}`;
  },
});

router.use(publicLimiter);

router.get("/tables/:token/menu", publicController.getMenu);
router.post("/tables/:token/orders", publicController.createOrder);
router.get("/orders/:id", publicController.getStatus);

module.exports = router;
