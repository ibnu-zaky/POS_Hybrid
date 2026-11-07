"use strict";

const crypto = require("crypto");
const { withTenantContext } = require("../config/database");

async function logAudit({ merchantId, eventType, actorId = null, metadata = {} }, client = null) {
  const run = async (c) => {
    console.log(`[AUDIT] eventType=${eventType} merchant=${merchantId}`);
    await c.query(
      `INSERT INTO audit_logs (id, event_type, user_id, merchant_id, metadata, occurred_at, received_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [crypto.randomUUID(), eventType, actorId, merchantId, JSON.stringify(metadata || {})],
    );
  };

  try {
    if (client) return run(client);
    if (!merchantId) return;
    await withTenantContext(merchantId, run);
  } catch (error) {
    console.error("logAudit error:", error.message, error.stack);
    throw error;
  }
}

module.exports = { logAudit };