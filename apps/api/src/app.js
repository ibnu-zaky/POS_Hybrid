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
const publicRoutes = require("./routes/public.routes");
const requestId = require("./middleware/request-id");
const metricsMiddleware = require("./middleware/metrics");
const { createRateLimiter } = require("./middleware/rate-limit");
const metrics = require("./services/metrics.service");
const errorHandler = require("./middleware/error-handler");

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
app.use("/public", publicRoutes);

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
app.use(errorHandler);

const openapiRoutes = require("./openapi");

// ============================================================
// OpenAPI spec endpoint
// ============================================================
app.get("/openapi.json", (_request, response) => {
  response.json(openapiRoutes.getOpenApiSpec());
});

module.exports = app;
