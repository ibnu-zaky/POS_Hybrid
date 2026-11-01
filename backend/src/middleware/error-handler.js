"use strict";

const env = require("../config/env");
const { AuthenticationError } = require("../services/auth.service");
const { TransactionError } = require("../services/transaction.service");
const { StockError } = require("../services/inventory.service");
const { ApiError } = require("../utils/api-error");

function errorHandler(error, request, response, _next) {
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
}

module.exports = errorHandler;