const env = require("./config/env");
const app = require("./app");
const { checkDatabase, closeDatabase } = require("./config/database");
const cache = require("./config/cache");

// Init Redis bila REDIS_URL diset; fallback in-memory bila gagal.
cache.initRedis().then(() => {
  console.log("Cache backend:", cache.status().backend);
}).catch(() => {
  console.warn("Redis init gagal, fallback in-memory cache");
});

const server = app.listen(env.PORT, () => {
  console.log(`POS Hybrid API listening on port ${env.PORT}`);
});

const healthCheckTimer = setInterval(async () => {
  try {
    await checkDatabase();
  } catch (error) {
    console.error("Database health check failed", error);
  }
}, env.DB_HEALTH_CHECK_INTERVAL_MS);

healthCheckTimer.unref();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  clearInterval(healthCheckTimer);

  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
