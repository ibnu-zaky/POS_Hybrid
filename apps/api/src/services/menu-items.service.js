"use strict";

const { withTenantContext } = require("../config/database");
const menuItemsRepository = require("../repositories/menu-items.repository");
const { ApiError } = require("../utils/api-error");

async function listMenuItems({ merchantId, categoryId, search, limit, offset }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return withTenantContext(merchantId, async (client) => {
    const [rows, total] = await Promise.all([
      menuItemsRepository.listMenuItems(client, merchantId, { categoryId, search, limit: safeLimit, offset: safeOffset }),
      menuItemsRepository.countMenuItems(client, merchantId, { categoryId, search }),
    ]);
    return { data: rows, meta: { limit: safeLimit, offset: safeOffset, total } };
  });
}

async function createMenuItem({ merchantId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    return menuItemsRepository.createMenuItem(client, merchantId, payload);
  });
}

async function updateMenuItem({ merchantId, menuId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await menuItemsRepository.findMenuItemById(client, merchantId, menuId);
    if (!existing) throw new ApiError(404, "Menu item not found");
    return menuItemsRepository.updateMenuItem(client, merchantId, menuId, payload);
  });
}

async function deleteMenuItem({ merchantId, menuId }) {
  return withTenantContext(merchantId, async (client) => {
    const deleted = await menuItemsRepository.softDeleteMenuItem(client, merchantId, menuId);
    if (!deleted) throw new ApiError(404, "Menu item not found");
    return deleted;
  });
}

async function setAvailability({ merchantId, menuId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const item = await menuItemsRepository.setAvailability(client, merchantId, menuId, payload.is_available);
    if (!item) throw new ApiError(404, "Menu item not found");
    return item;
  });
}

async function createVariant({ merchantId, menuId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const item = await menuItemsRepository.findMenuItemById(client, merchantId, menuId);
    if (!item) throw new ApiError(404, "Menu item not found");
    return menuItemsRepository.createVariant(client, merchantId, { ...payload, menu_item_id: menuId });
  });
}

async function listVariants({ merchantId, menuId }) {
  return withTenantContext(merchantId, async (client) => {
    const item = await menuItemsRepository.findMenuItemById(client, merchantId, menuId);
    if (!item) throw new ApiError(404, "Menu item not found");
    const rows = await menuItemsRepository.listVariants(client, merchantId, menuId);
    return { data: rows };
  });
}

module.exports = {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setAvailability,
  createVariant,
  listVariants,
};
