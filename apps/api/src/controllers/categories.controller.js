"use strict";

const categoriesService = require("../services/categories.service");
const {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} = require("../schemas/categories.schema");

function tenant(request) {
  return request.auth.merchant_id;
}

async function listCategories(request, response, next) {
  try {
    const data = await categoriesService.listCategories({ merchantId: tenant(request) });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createCategory(request, response, next) {
  try {
    const body = createCategorySchema.parse(request.body);
    const data = await categoriesService.createCategory({ merchantId: tenant(request), payload: body });
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(request, response, next) {
  try {
    const body = updateCategorySchema.parse(request.body);
    const data = await categoriesService.updateCategory({
      merchantId: tenant(request),
      categoryId: request.params.id,
      payload: body,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(request, response, next) {
  try {
    const data = await categoriesService.deleteCategory({
      merchantId: tenant(request),
      categoryId: request.params.id,
    });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

async function reorderCategories(request, response, next) {
  try {
    const body = reorderCategoriesSchema.parse(request.body);
    await categoriesService.reorderCategories({ merchantId: tenant(request), payload: body });
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
}

async function getCashierMenu(request, response, next) {
  try {
    const data = await categoriesService.getCashierMenu({ merchantId: tenant(request) });
    response.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCashierMenu,
};