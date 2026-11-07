const menuItemsService = require("../services/menu-items.service");
const {
  createMenuItemSchema,
  updateMenuItemSchema,
  availabilitySchema,
  createVariantSchema,
} = require("../schemas/menu-items.schema");

async function tenant(request) {
  return request.auth.merchant_id;
}

async function listMenuItems(request, response, next) {
  try {
    const result = await menuItemsService.listMenuItems({
      merchantId: request.auth.merchant_id,
      categoryId: request.query.category_id,
      search: request.query.search,
      limit: request.query.limit,
      offset: request.query.offset,
    });
    response.json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
}

async function createMenuItem(request, response, next) {
  try {
    const body = createMenuItemSchema.parse(request.body);
    const data = await menuItemsService.createMenuItem({ merchantId: request.auth.merchant_id, payload: body });
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function updateMenuItem(request, response, next) {
  try {
    const body = updateMenuItemSchema.parse(request.body);
    const data = await menuItemsService.updateMenuItem({
      merchantId: request.auth.merchant_id,
      menuId: request.params.id,
      payload: body,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function deleteMenuItem(request, response, next) {
  try {
    const data = await menuItemsService.deleteMenuItem({
      merchantId: request.auth.merchant_id,
      menuId: request.params.id,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function setAvailability(request, response, next) {
  try {
    const body = availabilitySchema.parse(request.body);
    const data = await menuItemsService.setAvailability({
      merchantId: request.auth.merchant_id,
      menuId: request.params.id,
      payload: body,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createVariant(request, response, next) {
  try {
    const body = createVariantSchema.parse(request.body);
    const data = await menuItemsService.createVariant({
      merchantId: request.auth.merchant_id,
      menuId: request.params.id,
      payload: body,
    });
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function listVariants(request, response, next) {
  try {
    const result = await menuItemsService.listVariants({
      merchantId: request.auth.merchant_id,
      menuId: request.params.id,
    });
    response.json({ data: result.data });
  } catch (error) {
    next(error);
  }
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