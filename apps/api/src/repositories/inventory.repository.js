async function listByMerchant(client, merchantId, { lowStock = false, limit = 20, offset = 0 } = {}) {
  const condition = lowStock ? "AND quantity <= reorder_point" : "";
  const result = await client.query(
    `SELECT id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at
     FROM inventory
     WHERE merchant_id = $1 ${condition}
     ORDER BY sku
     LIMIT $2 OFFSET $3`,
    [merchantId, limit, offset],
  );
  return result.rows;
}

async function countByMerchant(client, merchantId, { lowStock = false } = {}) {
  const condition = lowStock ? "AND quantity <= reorder_point" : "";
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM inventory WHERE merchant_id = $1 ${condition}`,
    [merchantId],
  );
  return result.rows[0]?.total || 0;
}

async function findById(client, merchantId, inventoryId) {
  const result = await client.query(
    `SELECT id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at
     FROM inventory WHERE id = $1 AND merchant_id = $2 LIMIT 1`,
    [inventoryId, merchantId],
  );
  return result.rows[0] || null;
}

async function findByIdForUpdate(client, merchantId, inventoryId) {
  const result = await client.query(
    `SELECT id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at
     FROM inventory WHERE id = $1 AND merchant_id = $2 LIMIT 1 FOR UPDATE`,
    [inventoryId, merchantId],
  );
  return result.rows[0] || null;
}

async function findBySkusForUpdate(client, merchantId, skus) {
  const result = await client.query(
    `SELECT id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at
     FROM inventory
     WHERE merchant_id = $1 AND sku = ANY($2)
     ORDER BY sku
     FOR UPDATE`,
    [merchantId, skus],
  );
  return result.rows;
}

async function findAvailability(client, merchantId, skus) {
  const result = await client.query(
    `SELECT sku, product_name, quantity, reorder_point
     FROM inventory
     WHERE merchant_id = $1 AND sku = ANY($2)
     ORDER BY sku`,
    [merchantId, skus],
  );
  return result.rows;
}

async function create(client, input) {
  const result = await client.query(
    `INSERT INTO inventory (merchant_id, sku, product_name, quantity, reorder_point, unit_cost)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at`,
    [input.merchantId, input.sku, input.productName, input.quantity, input.reorderPoint, input.unitCost ?? null],
  );
  return result.rows[0];
}

async function update(client, merchantId, inventoryId, { productName, reorderPoint, unitCost }) {
  const result = await client.query(
    `UPDATE inventory
     SET product_name = COALESCE($3, product_name),
         reorder_point = COALESCE($4, reorder_point),
         unit_cost = COALESCE($5, unit_cost),
         updated_at = NOW()
     WHERE id = $1 AND merchant_id = $2
     RETURNING id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at`,
    [inventoryId, merchantId, productName ?? null, reorderPoint ?? null, unitCost ?? null],
  );
  return result.rows[0] || null;
}

async function updateQuantity(client, merchantId, inventoryId, quantity) {
  const result = await client.query(
    `UPDATE inventory SET quantity = $3, updated_at = NOW()
     WHERE id = $1 AND merchant_id = $2
     RETURNING id, merchant_id, sku, product_name, quantity, reorder_point, unit_cost, created_at, updated_at`,
    [inventoryId, merchantId, quantity],
  );
  return result.rows[0] || null;
}

async function insertMovement(client, input) {
  const result = await client.query(
    `INSERT INTO inventory_movements (merchant_id, sku, quantity, type, transaction_id, reference_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, merchant_id, sku, quantity, type, transaction_id, reference_id, created_by, created_at`,
    [
      input.merchantId,
      input.sku,
      input.quantity,
      input.type,
      input.transactionId || null,
      input.referenceId || null,
      input.createdBy || null,
    ],
  );
  return result.rows[0];
}

async function listMovements(client, merchantId, { sku, limit = 50, offset = 0 } = {}) {
  const condition = sku ? "AND sku = $2" : "";
  const params = sku ? [merchantId, sku, limit, offset] : [merchantId, limit, offset];
  const result = await client.query(
    `SELECT id, merchant_id, sku, quantity, type, transaction_id, reference_id, created_by, created_at
     FROM inventory_movements
     WHERE merchant_id = $1 ${condition}
     ORDER BY created_at DESC
     LIMIT ${sku ? "$3" : "$2"} OFFSET ${sku ? "$4" : "$3"}`,
    params,
  );
  return result.rows;
}

module.exports = {
  listByMerchant,
  countByMerchant,
  findById,
  findByIdForUpdate,
  findBySkusForUpdate,
  findAvailability,
  create,
  update,
  updateQuantity,
  insertMovement,
  listMovements,
};
