const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const pinoHttp = require("pino-http");

const env = require("./config/env");
const { checkDatabase } = require("./config/database");
const authRoutes = require("./routes/auth.routes");
const posRoutes = require("./routes/pos.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const webhookRoutes = require("./routes/webhook.routes");
const { AuthenticationError } = require("./services/auth.service");
const { TransactionError } = require("./services/transaction.service");
const { StockError } = require("./services/inventory.service");

const app = express();

app.use(helmet());
app.use(cors());
app.use(pinoHttp());

app.use("/webhooks/payment", express.raw({ type: "application/json" }), webhookRoutes);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/pos", posRoutes);
app.use("/admin", adminRoutes);
app.use("/pos", paymentRoutes);

app.get("/health", async (_request, response) => {
  try {
    await checkDatabase();
    response.json({ status: "ok", database: "ok" });
  } catch (_error) {
    response.status(503).json({ status: "degraded", database: "unavailable" });
  }
});

// ============================================================
// Error handler terpusat — production tidak boleh leak stack trace
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((error, _request, response, _next) => {
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
