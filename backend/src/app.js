const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const pinoHttp = require("pino-http");

const env = require("./config/env");
const { checkDatabase } = require("./config/database");
const cache = require("./config/cache");
const authRoutes = require("./routes/auth.routes");
const posRoutes = require("./routes/pos.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const webhookRoutes = require("./routes/webhook.routes");
const requestId = require("./middleware/request-id");
const metricsMiddleware = require("./middleware/metrics");
const { createRateLimiter } = require("./middleware/rate-limit");
const metrics = require("./services/metrics.service");
const { AuthenticationError } = require("./services/auth.service");
const { TransactionError } = require("./services/transaction.service");
const { StockError } = require("./services/inventory.service");

const app = express();

// Trust proxy (ALB/nginx) — butuh untuk rate limit per IP asli & logging.
app.set("trust proxy", env.TRUST_PROXY);

// Helmet hardening — CSP nonaktif untuk API JSON (tanpa HTML served).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS allowlist — CORS_ORIGINS comma-separated; kosong = reflect all (dev only).
const allowedOrigins = (env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = allowedOrigins.length
  ? {
      origin(origin, callback) {
        // Tanpa origin (curl, server-to-server, mobile app) = izinkan.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.use(requestId);
app.use(
  pinoHttp({
    genReqId: (req) => req.id,
    autoLogging: env.NODE_ENV !== "test",
  }),
);
app.use(metricsMiddleware);

// Rate limit — global 100 req/menit; /auth lebih ketat (login brute-force).
const globalLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  skip: (req) => req.path === "/health" || req.path === "/metrics",
});
const authLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
});

app.use("/webhooks/payment", express.raw({ type: "application/json" }), webhookRoutes);
app.use(express.json({ limit: "1mb" }));

app.use("/auth", authLimiter, authRoutes);
app.use("/pos", globalLimiter, posRoutes);
app.use("/admin", globalLimiter, adminRoutes);
app.use("/pos", globalLimiter, paymentRoutes);
app.use(globalLimiter);

// ============================================================
// Observability endpoints
// ============================================================
app.get("/health", async (_request, response) => {
  try {
    await checkDatabase();
    response.json({ status: "ok", database: "ok", cache: cache.status() });
  } catch (_error) {
    response.status(503).json({ status: "degraded", database: "unavailable", cache: cache.status() });
  }
});

app.get("/metrics", (_request, response) => {
  response.json(metrics.snapshot());
});

// ============================================================
// Error handler terpusat — production tidak boleh leak stack trace
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((error, request, response, _next) => {
  // CORS rejection
  if (error && error.message === "Not allowed by CORS") {
    return response.status(403).json({ error: "Origin not allowed" });
  }

  // 401 — Authentication / credentials
  if (error instanceof AuthenticationError) {
    return response.status(401).json({ error: error.message });
  }

  // 400 — Business logic error (transaksi)
  if (error instanceof TransactionError) {
    return response.status(error.statusCode || 400).json({ error: error.message });
  }

  // 404/409 — Stock error (inventory)
  if (error instanceof StockError) {
    return response.status(error.statusCode || 409).json({ error: error.message });
  }

  // 400 — Zod validation
  if (error.name === "ZodError") {
    return response.status(400).json({ error: "Invalid request", details: error.issues });
  }

  // 400 — Invalid UUID cast dari PostgreSQL
  if (error.code === "22P02") {
    return response.status(400).json({ error: "Invalid id format" });
  }

  // 400 — Constraint violation (duplicate key, FK, check, dsb.)
  if (error.code === "23505") {
    return response.status(409).json({ error: "Resource already exists" });
  }

  if (error.code === "23503") {
    return response.status(400).json({ error: "Referenced resource does not exist" });
  }

  if (error.code === "23514") {
    return response.status(400).json({ error: "Value violates a check constraint" });
  }

  // 403 — RLS policy violation (new_row violates row-level security policy)
  if (error.code === "42501") {
    return response.status(403).json({ error: "Access denied" });
  }

  // 500 — Semua error internal: jangan ekspos detail di production
  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;

  if (env.NODE_ENV === "production") {
    return response.status(statusCode).json({ error: "Internal server error" });
  }

  // Di development/test, sertakan message dan stack untuk debugging
  return response.status(statusCode).json({
    error: error.message || "Internal server error",
    ...(error.stack ? { stack: error.stack } : {}),
  });
});

module.exports = app;
