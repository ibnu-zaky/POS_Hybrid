"use strict";

async function lookupTable(client, token) {
  const result = await client.query("SELECT * FROM public.lookup_table_by_token($1)", [token]);
  return result.rows[0] || null;
}

async function getMenu(client, merchantId) {
  // Category + items
  const cats = await client.query(
    "SELECT id, name, icon, sort_order FROM categories WHERE merchant_id = $1 ORDER BY sort_order, name",
    [merchantId],
  );
  const items = await client.query(
    `SELECT id, category_id, name, price, image_url, sku 
     FROM menu_items 
     WHERE merchant_id = $1 AND is_available = true AND is_active = true 
     ORDER BY sort_order, name`,
    [merchantId],
  );
  return { categories: cats.rows, items: items.rows };
}

async function lookupOrder(client, { orderId, publicToken }) {
  const result = await client.query(
    "SELECT * FROM public.lookup_order_by_public_token($1, $2)",
    [orderId, publicToken],
  );
  return result.rows[0] || null;
}

module.exports = {
  lookupTable,
  getMenu,
  lookupOrder,
};
