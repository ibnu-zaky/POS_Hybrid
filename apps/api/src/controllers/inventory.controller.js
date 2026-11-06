const inventoryService = require("../services/inventory.service");
const {
  createInventorySchema, updateInventorySchema, adjustStockSchema,
} = require("../schemas/inventory.schema");

function tenant(request) { return request.auth.merchant_id; }

async function listInventory(request, response, next) {
  try {
    const result = await inventoryService.listInventory({
      merchantId: tenant(request),
      lowStock: request.query.low_stock === "true",
      limit: request.query.limit,
      offset: request.query.offset,
    });
    response.json({ data: result.data, meta: result.meta });
  } catch (error) { next(error); }
}

async function createInventory(request, response, next) {
  try {
    const body = createInventorySchema.parse(request.body);
    const item = await inventoryService.createInventory({
      merchantId: tenant(request),
      staffId: request.auth.sub,
      payload: body,
    });
    response.status(201).json({ data: item });
  } catch (error) { next(error); }
}

async function updateInventory(request, response, next) {
  try {
    const body = updateInventorySchema.parse(request.body);
    const item = await inventoryService.updateInventory({
      merchantId: tenant(request),
      inventoryId: request.params.id,
      payload: body,
    });
    if (!item) return response.status(404).json({ error: "Inventory item not found" });
    response.json({ data: item });
  } catch (error) { next(error); }
}

async function adjustStock(request, response, next) {
  try {
    const body = adjustStockSchema.parse(request.body);
    const item = await inventoryService.adjustStock({
      merchantId: tenant(request),
      inventoryId: request.params.id,
      staffId: request.auth.sub,
      payload: body,
    });
    response.json({ data: item });
  } catch (error) { next(error); }
}

async function listMovements(request, response, next) {
  try {
    const data = await inventoryService.listMovements({
      merchantId: tenant(request),
      sku: request.query.sku,
      limit: request.query.limit,
      offset: request.query.offset,
    });
    response.json({ data });
  } catch (error) { next(error); }
}

module.exports = {
  listInventory, createInventory, updateInventory, adjustStock, listMovements,
};
