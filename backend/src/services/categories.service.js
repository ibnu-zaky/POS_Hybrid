"use strict";

const { withTenantContext } = require("../config/database");
const categoriesRepository = require("../repositories/categories.repository");
const menuItemsRepository = require("../repositories/menu-items.repository");
const { ApiError } = require("../utils/api-error");

async function listCategories({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    return categoriesRepository.listCategories(client, merchantId);
  });
}

async function createCategory({ merchantId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    return categoriesRepository.createCategory(client, merchantId, payload);
  });
}

async function updateCategory({ merchantId, categoryId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await categoriesRepository.findCategoryById(client, merchantId, categoryId);
    if (!existing) throw new ApiError(404, "Category not found");
    return categoriesRepository.updateCategory(client, merchantId, categoryId, payload);
  });
}

async function deleteCategory({ merchantId, categoryId }) {
  return withTenantContext(merchantId, async (client) => {
    const count = await menuItemsRepository.countMenuItems(client, merchantId, { categoryId, activeOnly: false });
    if (count > 0) throw new ApiError(409, "Cannot delete category that still has menu items");
    const deleted = await categoriesRepository.deleteCategory(client, merchantId, categoryId);
    if (!deleted) throw new ApiError(404, "Category not found");
    return deleted;
  });
}

async function reorderCategories({ merchantId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    return categoriesRepository.reorderCategories(client, merchantId, payload.category_ids);
  });
}

async function getCashierMenu({ merchantId }) {
  return withTenantContext(merchantId, async (client) => {
    const [categories, items] = await Promise.all([
      categoriesRepository.listCategories(client, merchantId),
      menuItemsRepository.listMenuItems(client, merchantId, { activeOnly: true, limit: 1000 }),
    ]);

    // Group items by category
    const itemsByCategory = items.data.reduce((acc, item) => {
      const cid = item.category_id || "uncategorized";
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(item);
      return acc;
    }, {});

    return categories.map((cat) => ({
      ...cat,
      items: itemsByCategory[cat.id] || [],
    }));
  });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCashierMenu,
};