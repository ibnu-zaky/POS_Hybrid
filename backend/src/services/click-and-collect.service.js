"use strict";

const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const cncRepository = require("../repositories/click-and-collect.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const { applyStockDeltas } = require("./inventory.service");

function generatePickupCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
}

// ——— Create Reservation ———

async function createReservation({ merchantId, staffId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    // Validasi stok tersedia (lock FOR UPDATE)
    const skus = payload.items.map((item) => item.sku);
    const inventoryRows = await inventoryRepository.findBySkusForUpdate(client, merchantId, skus);
    const bySku = new Map(inventoryRows.map((row) => [row.sku, row]));

    for (const item of payload.items) {
      const inv = bySku.get(item.sku);
      if (!inv) {
        throw Object.assign(new Error(`SKU ${item.sku} tidak ditemukan di inventory`), { statusCode: 404 });
      }
      if (Number(inv.quantity) < item.quantity) {
        throw Object.assign(
          new Error(`Stok tidak cukup untuk SKU ${item.sku} (tersedia: ${inv.quantity}, diminta: ${item.quantity})`),
          { statusCode: 409 },
        );
      }
    }

    // Deduksi stok (hold) — physical deduction
    await applyStockDeltas(client, {
      merchantId,
      items: payload.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
      sign: -1,
      type: "cnc_reserve",
      createdBy: staffId,
    });

    // Generate pickup code unik
    let pickupCode;
    let attempts = 0;
    do {
      pickupCode = generatePickupCode();
      const existing = await cncRepository.findByPickupCode(client, { merchantId, pickupCode });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const order = await cncRepository.create(client, {
      merchantId,
      sourceOrderId: payload.source_order_id,
      customerName: payload.customer_name,
      customerPhone: payload.customer_phone,
      reservedItems: payload.items,
      pickupCode,
      notes: payload.notes,
    });

    return order;
  });
}

// ——— List ———

async function listReservations({ merchantId, status, limit, offset }) {
  return withTenantContext(merchantId, async (client) => {
    return cncRepository.listByMerchant(client, { merchantId, status, limit, offset });
  });
}

async function getReservation({ merchantId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const order = await cncRepository.findById(client, { merchantId, id });
    if (!order) {
      throw Object.assign(new Error("Reservasi tidak ditemukan"), { statusCode: 404 });
    }
    return order;
  });
}

// ——— Verify Pickup ———

async function verifyPickup({ merchantId, staffId, pickup_code }) {
  return withTenantContext(merchantId, async (client) => {
    const order = await cncRepository.findByPickupCode(client, { merchantId, pickupCode: pickup_code });
    if (!order) {
      throw Object.assign(new Error("Kode pickup tidak ditemukan"), { statusCode: 404 });
    }

    if (order.status === "picked_up") {
      throw Object.assign(new Error("Order sudah pernah di-pickup"), { statusCode: 409 });
    }
    if (order.status === "expired" || order.status === "cancelled") {
      throw Object.assign(new Error(`Order sudah ${order.status}, tidak bisa pickup`), { statusCode: 409 });
    }

    // Stok sudah di-deduct saat reserve — tinggal update status
    const updated = await cncRepository.updateStatus(client, {
      merchantId,
      id: order.id,
      status: "picked_up",
      pickedUpBy: staffId,
    });

    return { ...updated, customer_name: order.customer_name, reserved_items: order.reserved_items };
  });
}

// ——— Cancel ———

async function cancelReservation({ merchantId, staffId, id }) {
  return withTenantContext(merchantId, async (client) => {
    const order = await cncRepository.findById(client, { merchantId, id });
    if (!order) {
      throw Object.assign(new Error("Reservasi tidak ditemukan"), { statusCode: 404 });
    }

    if (order.status !== "pending" && order.status !== "ready") {
      throw Object.assign(new Error(`Tidak bisa cancel order berstatus ${order.status}`), { statusCode: 409 });
    }

    // Restock — balikkan stok yang di-hold
    await applyStockDeltas(client, {
      merchantId,
      items: order.reserved_items,
      sign: 1,
      type: "cnc_cancel",
      createdBy: staffId,
      referenceId: order.id,
    });

    const updated = await cncRepository.updateStatus(client, {
      merchantId,
      id,
      status: "cancelled",
    });

    return updated;
  });
}

// ——— Expire (batch) ———

async function expireReservations({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    // Update dulu status expired
    const expired = await cncRepository.expirePending(client);

    // Filter hanya milik merchant ini (expirePending tanpa merchant filter — untuk efficiency)
    const merchantExpired = expired.filter((row) => row.merchant_id === merchantId);

    // Restock semua yang expired
    for (const order of merchantExpired) {
      await applyStockDeltas(client, {
        merchantId,
        items: order.reserved_items,
        sign: 1,
        type: "cnc_expire",
        referenceId: order.id,
      });
    }

    return { expired: merchantExpired.length };
  });
}

module.exports = {
  createReservation,
  listReservations,
  getReservation,
  verifyPickup,
  cancelReservation,
  expireReservations,
};
