async function listTables(client, merchantId) {
  const result = await client.query(
    `SELECT id, merchant_id, number, token, is_active, created_at, updated_at
     FROM dining_tables
     WHERE merchant_id = $1
     ORDER BY number`,
    [merchantId],
  );
  return result.rows;
}

async function findTableById(client, merchantId, tableId) {
  const result = await client.query(
    `SELECT id, merchant_id, number, token, is_active, created_at, updated_at
     FROM dining_tables
     WHERE id = $1 AND merchant_id = $2 LIMIT 1`,
    [tableId, merchantId],
  );
  return result.rows[0] || null;
}

async function createTable(client, merchantId, input) {
  const result = await client.query(
    `INSERT INTO dining_tables (merchant_id, number, token)
     VALUES ($1, $2, $3)
     RETURNING id, merchant_id, number, token, is_active, created_at, updated_at`,
    [merchantId, input.number, input.token],
  );
  return result.rows[0];
}

async function deleteTable(client, merchantId, tableId) {
  const result = await client.query(
    `DELETE FROM dining_tables WHERE id = $1 AND merchant_id = $2
     RETURNING id, merchant_id, number, token, is_active`,
    [tableId, merchantId],
  );
  return result.rows[0] || null;
}

async function regenerateToken(client, merchantId, tableId) {
  const token = crypto.randomBytes(24).toString('base64url').replace(/-/g, '').replace(/_/g, '');
  const result = await client.query(
    `UPDATE dining_tables SET token = $1, updated_at = NOW()
     WHERE id = $2 AND merchant_id = $3
     RETURNING id, merchant_id, number, token, is_active, created_at, updated_at`,
    [token, tableId, merchantId],
  );
  return result.rows[0] || null;
}

async function findTableByToken(client, token) {
  const result = await client.query(
    `SELECT merchant_id, id AS table_id, number
     FROM dining_tables
     WHERE token = $1`,
    [token],
  );
  return result.rows[0] || null;
}

const crypto = require('crypto');

module.exports = {
  listTables,
  findTableById,
  createTable,
  deleteTable,
  regenerateToken,
  findTableByToken,
};