const { withTenantContext } = require("../config/database");
const inventoryRepository = require("../repositories/inventory.repository");

class StockError extends Error {
  constructor(message = "Stock error", statusCode = 409) {
    super(message);
    this.name = "StockError";
    this.statusCode = statusCode;
  }
}

function stockStatus(quantity, reorderPoint) {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderPoint) return "critical";
  if (quantity <= reorderPoint * 2) return "low";
  return "optimal";
}

/**
 * Terapkan delta stok untuk sekumpulan item transaksi, atomik di client
 * yang sudah membuka transaksi DB (BEGIN sudah jalan).
 *
 * sign: -1 = kurangi stok (sale), +1 = tambah (restock/return).
 * SKU tanpa baris inventory = untracked, dilewati (tracking opt-in per SKU).
 */
async function applyStockDeltas(client, { merchantId, items, sign, type, transactionId = null, createdBy = null, referenceId = null }) {
  const trackedItems = (items || []).filter((item) => item.sku && Number(item.quantity) > 0);
  if (!trackedItems.length) {
    return { movements: 0 };
  }

  const unitsBySku = new Map();
  for (const item of trackedItems) {
    unitsBySku.set(item.sku, (unitsBySku.get(item.sku) || 0) + Number(item.quantity));
  }

  const skus = [...unitsBySku.keys()];
  const rows = await inventoryRepository.findBySkusForUpdate(client, merchantId, skus);
  const bySku = new Map(rows.map((row) => [row.sku, row]));

  let movements = 0;
  for (const sku of skus) {
    const inventory = bySku.get(sku);
    if (!inventory) continue; // untracked SKU

    const delta = Number(unitsBySku.get(sku)) * Number(sign);
    const nextQuantity = Number(inventory.quantity) + delta;

    if (nextQuantity < 0) {
      throw new StockError(`Insufficient stock for SKU ${sku} (available: ${inventory.quantity})`, 409);
    }

    await inventoryRepository.updateQuantity(client, merchantId, inventory.id, nextQuantity);
    await inventoryRepository.insertMovement(client, {
      merchantId,
      sku,
      quantity: delta,
      type,
      transactionId,
      referenceId,
      createdBy,
    });
    movements += 1;
  }

  return { movements };
}

async function listInventory({ merchantId, lowStock = false, limit = 20, offset = 0 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return withTenantContext(merchantId, async (client) => {
    const [rows, total] = await Promise.all([
      inventoryRepository.listByMerchant(client, merchantId, { lowStock, limit: safeLimit, offset: safeOffset }),
      inventoryRepository.countByMerchant(client, merchantId, { lowStock }),
    ]);

    return {
      data: rows,
      meta: { limit: safeLimit, offset: safeOffset, total, low_stock: Boolean(lowStock) },
    };
  });
}

async function createInventory({ merchantId, staffId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const item = await inventoryRepository.create(client, {
      merchantId,
      sku: payload.sku,
      productName: payload.product_name,
      quantity: payload.quantity,
      reorderPoint: payload.reorder_point,
      unitCost: payload.unit_cost,
    });

    if (item.quantity > 0) {
      await inventoryRepository.insertMovement(client, {
        merchantId,
        sku: item.sku,
        quantity: item.quantity,
        type: "adjustment",
        createdBy: staffId,
      });
    }

    return item;
  });
}

async function updateInventory({ merchantId, inventoryId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await inventoryRepository.findById(client, merchantId, inventoryId);
    if (!existing) throw new StockError("Inventory item not found", 404);

    return inventoryRepository.update(client, merchantId, inventoryId, {
      productName: payload.product_name,
      reorderPoint: payload.reorder_point,
      unitCost: payload.unit_cost,
    });
  });
}

async function adjustStock({ merchantId, inventoryId, staffId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await inventoryRepository.findByIdForUpdate(client, merchantId, inventoryId);
    if (!existing) throw new StockError("Inventory item not found", 404);

    const delta = Number(payload.quantity);
    const nextQuantity = Number(existing.quantity) + delta;

    if (delta === 0) {
      throw new StockError("Adjustment quantity must not be zero", 400);
    }
    if (nextQuantity < 0) {
      throw new StockError(`Stock cannot go below 0 for SKU ${existing.sku} (available: ${existing.quantity})`, 409);
    }

    const updated = await inventoryRepository.updateQuantity(client, merchantId, existing.id, nextQuantity);
    await inventoryRepository.insertMovement(client, {
      merchantId,
      sku: existing.sku,
      quantity: delta,
      type: "adjustment",
      referenceId: payload.reference_id,
      createdBy: staffId,
    });

    return updated;
  });
}

async function getAvailability({ merchantId, skus }) {
  return withTenantContext(merchantId, async (client) => {
    const rows = await inventoryRepository.findAvailability(client, merchantId, skus);

    const data = {};
    for (const row of rows) {
      data[row.sku] = {
        product_name: row.product_name,
        quantity: row.quantity,
        available: row.quantity > 0,
        reorder_point: row.reorder_point,
        status: stockStatus(row.quantity, row.reorder_point),
      };
    }
    return data;
  });
}

async function listMovements({ merchantId, sku, limit = 50, offset = 0 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return withTenantContext(merchantId, (client) =>
    inventoryRepository.listMovements(client, merchantId, { sku, limit: safeLimit, offset: safeOffset }),
  );
}

module.exports = {
  StockError,
  applyStockDeltas,
  listInventory,
  createInventory,
  updateInventory,
  adjustStock,
  getAvailability,
  listMovements,
};
