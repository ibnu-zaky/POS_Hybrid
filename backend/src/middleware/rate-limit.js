"use strict";

/**
 * Rate limiting middleware — fixed window per IP.
 * Tanpa dependency eksternal: in-memory Map + periodic cleanup.
 */

const env = require("../config/env");

const buckets = new Map(); // key -> { count, resetAt }

function cleanup() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// Cleanup tiap menit (unref agar tidak menahan process exit)
const cleanupTimer = setInterval(cleanup, 60_000);
cleanupTimer.unref?.();

/**
 * @param {{ windowMs?: number, max?: number, keyGenerator?: (req)=>string, skip?: (req)=>boolean }} options
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? env.RATE_LIMIT_MAX;
  const keyGenerator = options.keyGenerator ?? defaultKey;
  const skip = options.skip ?? (() => false);

  return function rateLimit(request, response, next) {
    if (env.NODE_ENV === "test" && !options.forceInTest) {
      // Rate limiting nonaktif di test agar tidak mengganggu suite paralel,
      // kecuali test eksplisit memakai forceInTest.
      return next();
    }
    if (skip(request)) return next();

    const key = keyGenerator(request);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);

    response.setHeader("X-RateLimit-Limit", String(max));
    response.setHeader("X-RateLimit-Remaining", String(remaining));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      response.setHeader("Retry-After", String(retryAfterSec));
      return response.status(429).json({ error: "Too many requests, please try again later" });
    }

    return next();
  };
}

function defaultKey(request) {
  // Di belakang ALB/nginx, express sudah resolve IP asli bila trust proxy aktif.
  return request.ip || request.socket?.remoteAddress || "unknown";
}

/** Reset semua bucket (untuk test). */
function resetRateLimits() {
  buckets.clear();
}

module.exports = { createRateLimiter, resetRateLimits };
