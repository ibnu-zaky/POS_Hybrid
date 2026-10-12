"use strict";

/**
 * Metrics middleware — record latency, status, rate-limit hits.
 */

const metrics = require("../services/metrics.service");

function metricsMiddleware(request, response, next) {
  const start = process.hrtime.bigint();

  response.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    // Gabungkan baseUrl + route path; fallback ke path penuh bila route tidak match.
    const routePath = request.route?.path
      ? `${request.baseUrl}${request.route.path}`
      : request.path;
    const route = `${request.method} ${routePath}`;
    metrics.observeLatency(route, ms);
    metrics.observeStatus(response.statusCode);
    if (response.statusCode === 429) metrics.increment("http_rate_limited_total");
    metrics.increment("http_requests_total");
  });

  return next();
}

module.exports = metricsMiddleware;
