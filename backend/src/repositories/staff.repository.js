async function findByEmail(client, email) {
  const result = await client.query(
    `SELECT id, merchant_id, email, name, role, password_hash, is_active
     FROM staff
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  );

  return result.rows[0] || null;
}

async function findAll(client, merchantId) {
  const result = await client.query(
    `SELECT id, merchant_id, email, name, role, is_active, created_at
     FROM staff WHERE merchant_id = $1 ORDER BY created_at ASC`, [merchantId],
  );
  return result.rows;
}

async function findById(client, merchantId, staffId) {
  const result = await client.query(
    `SELECT id, merchant_id, email, name, role, is_active, created_at
     FROM staff WHERE merchant_id = $1 AND id = $2 LIMIT 1`, [merchantId, staffId],
  );
  return result.rows[0] || null;
}

async function create(client, { merchantId, email, name, role, passwordHash }) {
  const result = await client.query(
    `INSERT INTO staff (merchant_id, email, name, role, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, merchant_id, email, name, role, is_active, created_at`,
    [merchantId, email, name, role, passwordHash],
  );
  return result.rows[0];
}

async function update(client, { merchantId, staffId, role, isActive }) {
  const result = await client.query(
    `UPDATE staff SET role = COALESCE($3, role), is_active = COALESCE($4, is_active)
     WHERE merchant_id = $1 AND id = $2
     RETURNING id, merchant_id, email, name, role, is_active, created_at`,
    [merchantId, staffId, role || null, isActive ?? null],
  );
  return result.rows[0] || null;
}

async function deactivate(client, merchantId, staffId) {
  return update(client, { merchantId, staffId, isActive: false });
}

module.exports = {
  findByEmail,
  findAll,
  findById,
  create,
  update,
  deactivate,
};
