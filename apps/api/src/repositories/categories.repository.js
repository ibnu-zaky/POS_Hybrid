"use strict";

async function listCategories(client, merchantId) {
  const result = await client.query(
    `SELECT id, merchant_id, name, icon, sort_order, created_at, updated_at
     FROM categories
     WHERE merchant_id = $1
     ORDER BY sort_order, name`,
    [merchantId],
  );
  return result.rows;
}

async function findCategoryById(client, merchantId, categoryId) {
  const result = await client.query(
    `SELECT id, merchant_id, name, icon, sort_order, created_at, updated_at
     FROM categories WHERE id = $1 AND merchant_id = $2 LIMIT 1`,
    [categoryId, merchantId],
  );
  return result.rows[0] || null;
}

async function createCategory(client, merchantId, input) {
  const result = await client.query(
    `INSERT INTO categories (merchant_id, name, icon, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, merchant_id, name, icon, sort_order, created_at, updated_at`,
    [merchantId, input.name, input.icon ?? null, input.sort_order],
  );
  return result.rows[0];
}

async function updateCategory(client, merchantId, categoryId, input) {
  const sets = [];
  const params = [];
  if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${params.length}`); }
  if (input.icon !== undefined) { params.push(input.icon ?? null); sets.push(`icon = $${params.length}`); }
  if (input.sort_order !== undefined) { params.push(input.sort_order); sets.push(`sort_order = $${params.length}`); }

  if (!sets.length) {
    return findCategoryById(client, merchantId, categoryId);
  }

  params.push(categoryId, merchantId);
  const result = await client.query(
    `UPDATE categories SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND merchant_id = $${params.length}
     RETURNING id, merchant_id, name, icon, sort_order, created_at, updated_at`,
    params,
  );
  return result.rows[0] || null;
}

async function deleteCategory(client, merchantId, categoryId) {
  const result = await client.query(
    `DELETE FROM categories WHERE id = $1 AND merchant_id = $2
     RETURNING id, merchant_id, name, icon, sort_order`,
    [categoryId, merchantId],
  );
  return result.rows[0] || null;
}

async function reorderCategories(client, merchantId, categoryIds) {
  await client.query("BEGIN");
  try {
    for (let i = 0; i < categoryIds.length; i++) {
      await client.query(
        `UPDATE categories SET sort_order = $1, updated_at = NOW()
         WHERE id = $2 AND merchant_id = $3`,
        [i, categoryIds[i], merchantId],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

module.exports = {
  listCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};