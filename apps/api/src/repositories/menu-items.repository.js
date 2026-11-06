"use strict";

async function listMenuItems(client, merchantId, { categoryId = null, activeOnly = true, search = null, limit = 50, offset = 0 } = {}) {
  const conditions = ["merchant_id = $1"];
  const params = [merchantId];

  if (activeOnly) conditions.push("is_active = true");
  if (categoryId) { params.push(categoryId); conditions.push(`category_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const result = await client.query(
    `SELECT id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at
     FROM menu_items
     ${where}
     ORDER BY sort_order, name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows;
}

async function countMenuItems(client, merchantId, { categoryId = null, activeOnly = true, search = null } = {}) {
  const conditions = ["merchant_id = $1"];
  const params = [merchantId];

  if (activeOnly) conditions.push("is_active = true");
  if (categoryId) { params.push(categoryId); conditions.push(`category_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await client.query(
    `SELECT COUNT(*)::int AS total FROM menu_items ${where}`,
    params,
  );
  return result.rows[0]?.total || 0;
}

async function findMenuItemById(client, merchantId, menuId) {
  const result = await client.query(
    `SELECT id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at
     FROM menu_items WHERE id = $1 AND merchant_id = $2 LIMIT 1`,
    [menuId, merchantId],
  );
  return result.rows[0] || null;
}

async function createMenuItem(client, merchantId, input) {
  const result = await client.query(
    `INSERT INTO menu_items (merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at`,
    [
      merchantId,
      input.category_id ?? null,
      input.name,
      input.price,
      input.image_url ?? null,
      input.is_available,
      input.is_active,
      input.track_stock,
      input.sku ?? null,
      input.sort_order,
    ],
  );
  return result.rows[0];
}

async function updateMenuItem(client, merchantId, menuId, input) {
  const sets = [];
  const params = [];
  for (const key of ["category_id", "name", "price", "image_url", "is_available", "is_active", "track_stock", "sku", "sort_order"]) {
    if (input[key] !== undefined) {
      params.push(input[key] ?? null);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) return findMenuItemById(client, merchantId, menuId);

  params.push(menuId, merchantId);
  const result = await client.query(
    `UPDATE menu_items SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND merchant_id = $${params.length}
     RETURNING id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at`,
    params,
  );
  return result.rows[0] || null;
}

async function softDeleteMenuItem(client, merchantId, menuId) {
  const result = await client.query(
    `UPDATE menu_items SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND merchant_id = $2
     RETURNING id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at`,
    [menuId, merchantId],
  );
  return result.rows[0] || null;
}

async function setAvailability(client, merchantId, menuId, isAvailable) {
  const result = await client.query(
    `UPDATE menu_items SET is_available = $1, updated_at = NOW()
     WHERE id = $2 AND merchant_id = $3
     RETURNING id, merchant_id, category_id, name, price, image_url, is_available, is_active, track_stock, sku, sort_order, created_at, updated_at`,
    [isAvailable, menuId, merchantId],
  );
  return result.rows[0] || null;
}

async function menuCountByCategory(client, merchantId) {
  const result = await client.query(
    `SELECT category_id, COUNT(*)::int AS total
     FROM menu_items
     WHERE merchant_id = $1
     GROUP BY category_id`,
    [merchantId],
  );
  return result.rows.map((r) => ({ category_id: r.category_id, total: r.total }));
}

module.exports = {
  listMenuItems,
  countMenuItems,
  findMenuItemById,
  createMenuItem,
  updateMenuItem,
  softDeleteMenuItem,
  setAvailability,
  menuCountByCategory,
};