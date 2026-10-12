"use strict";

/**
 * Cache abstraction — Redis (opsional, via REDIS_URL) dengan fallback in-memory TTL.
 * - Tanpa REDIS_URL: Map in-memory + TTL (cukup untuk single instance / dev).
 * - Dengan REDIS_URL: pakai `redis` package bila terpasang; jika koneksi gagal,
 *   fallback in-memory agar aplikasi tetap jalan.
 *
 * Catatan produksi: di multi-instance, gunakan Redis managed (ElastiCache).
 */

const env = require("../config/env");

const memory = new Map(); // key -> { value, expiresAt }

let redisClient = null;
let redisReady = false;
let redisFailed = false;

async function initRedis() {
  if (!env.REDIS_URL || redisReady || redisFailed) return redisClient;
  try {
    // Optional dependency — hanya di-load bila REDIS_URL diset.
    // eslint-disable-next-line import/no-extraneous-dependencies
    const { createClient } = require("redis");
    redisClient = createClient({ url: env.REDIS_URL });
    redisClient.on("error", () => {
      // Jangan crash; fallback in-memory.
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch (_error) {
    redisFailed = true;
    redisClient = null;
    return null;
  }
}

function cacheKey(namespace, parts) {
  return `${namespace}:${parts.join(":")}`;
}

async function get(namespace, parts) {
  const key = cacheKey(namespace, parts);

  if (redisReady && redisClient) {
    try {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      // fall through to memory
    }
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

async function set(namespace, parts, value, ttlSeconds) {
  const key = cacheKey(namespace, parts);
  const ttl = ttlSeconds ?? env.CACHE_DEFAULT_TTL_SECONDS;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;

  if (redisReady && redisClient) {
    try {
      const payload = JSON.stringify(value);
      if (ttl > 0) await redisClient.setEx(key, ttl, payload);
      else await redisClient.set(key, payload);
      return;
    } catch (_error) {
      // fall through to memory
    }
  }

  memory.set(key, { value, expiresAt });
}

async function del(namespace, parts) {
  const key = cacheKey(namespace, parts);

  if (redisReady && redisClient) {
    try {
      await redisClient.del(key);
    } catch (_error) {
      // ignore
    }
  }

  memory.delete(key);
}

/** Hapus semua key pada namespace (prefix match) — untuk invalidation broad. */
async function delNamespace(namespace) {
  const prefix = `${namespace}:`;

  if (redisReady && redisClient) {
    try {
      // SCAN aman untuk production (bukan KEYS)
      let cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length) await redisClient.del(reply.keys);
      } while (cursor !== 0);
    } catch (_error) {
      // ignore
    }
  }

  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** Clear in-memory cache (test helper). */
function clearMemory() {
  memory.clear();
}

function status() {
  return {
    backend: redisReady ? "redis" : "memory",
    redis_url_configured: Boolean(env.REDIS_URL),
    redis_failed: redisFailed,
    memory_entries: memory.size,
  };
}

module.exports = {
  initRedis,
  get,
  set,
  del,
  delNamespace,
  clearMemory,
  status,
  cacheKey,
};
