"use strict";

/**
 * Metrics service — in-memory counters & latency histogram.
 * Metrik di-reset saat process restart (cukup untuk single-instance MVP;
 * production multi-instance gunakan Prometheus/StatsD dari ALB/ECS sidecar).
 */

const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(50);

const counters = {
  http_requests_total: 0,
  http_errors_total: 0,
  http_rate_limited_total: 0,
  payment_created_total: 0,
  payment_paid_total: 0,
  payment_failed_total: 0,
  payment_refunded_total: 0,
  payment_expired_total: 0,
  webhook_processed_total: 0,
  webhook_rejected_total: 0,
};

/** Latency per route pattern (method + route path) — simpan ring buffer 1000 sample. */
const latencyByRoute = new Map(); // "GET /pos/transactions" -> number[] (ms)

const STATUS_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000];
let statusCounts = Object.fromEntries(STATUS_BUCKETS.map((b) => [b, 0]));
let statusOver = 0;

function increment(counter, by = 1) {
  if (counter in counters) {
    counters[counter] += by;
    bus.emit("counter", { counter, value: counters[counter] });
  }
}

function observeLatency(route, ms) {
  if (!Number.isFinite(ms)) return;
  let arr = latencyByRoute.get(route);
  if (!arr) {
    arr = [];
    latencyByRoute.set(route, arr);
  }
  arr.push(ms);
  if (arr.length > 1000) arr.shift();

  const bucket = STATUS_BUCKETS.find((b) => ms <= b);
  if (bucket) statusCounts[bucket] += 1;
  else statusOver += 1;
}

function observeStatus(code) {
  if (code >= 400) increment("http_errors_total");
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function snapshot() {
  const routes = {};
  for (const [route, samples] of latencyByRoute) {
    const sorted = [...samples].sort((a, b) => a - b);
    routes[route] = {
      count: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      avg: sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0,
    };
  }

  const paymentTotal =
    counters.payment_created_total || 1;
  const paymentSuccessRate = counters.payment_paid_total / paymentTotal;

  return {
    counters: { ...counters },
    latency_ms: routes,
    status_buckets: {
      ...Object.fromEntries(STATUS_BUCKETS.map((b) => [`lt_${b}`, statusCounts[b]])),
      gte_5000: statusOver,
    },
    payment_success_rate: Number.isFinite(paymentSuccessRate) ? Number(paymentSuccessRate.toFixed(4)) : 0,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

function reset() {
  for (const key of Object.keys(counters)) counters[key] = 0;
  latencyByRoute.clear();
  statusCounts = Object.fromEntries(STATUS_BUCKETS.map((b) => [b, 0]));
  statusOver = 0;
}

module.exports = {
  increment,
  observeLatency,
  observeStatus,
  snapshot,
  reset,
  bus,
};
