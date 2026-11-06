async function findById(client, merchantId) {
  const result = await client.query(
    `SELECT id, name, email, status, subscription_tier
     FROM merchants
     WHERE id = $1
     LIMIT 1`,
    [merchantId],
  );

  return result.rows[0] || null;
}

async function update(client, { merchantId, name, email }) {
  const result = await client.query(
    `UPDATE merchants SET name = COALESCE($2, name), email = COALESCE($3, email)
     WHERE id = $1
     RETURNING id, name, email, status, subscription_tier`,
    [merchantId, name || null, email || null],
  );
  return result.rows[0] || null;
}

module.exports = {
  findById,
  update,
};
