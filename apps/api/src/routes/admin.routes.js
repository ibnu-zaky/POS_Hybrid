const express = require("express");
const authenticate = require("../middleware/authenticate");
const tenantContext = require("../middleware/tenant-context");
const authorize = require("../middleware/authorize");
const controller = require("../controllers/admin.controller");
const inventoryController = require("../controllers/inventory.controller");
const hrController = require("../controllers/hr.controller");
const analyticsController = require("../controllers/analytics.controller");
const ecommerceController = require("../controllers/ecommerce.controller");
const cncController = require("../controllers/click-and-collect.controller");
const accountingController = require("../controllers/accounting.controller");
const categoriesController = require("../controllers/categories.controller");
const menuItemsController = require("../controllers/menu-items.controller");
const tablesController = require("../controllers/tables.controller");

const router = express.Router();
router.use(authenticate, tenantContext, authorize(["admin"]));
router.get("/staff", controller.listStaff);
router.post("/staff", controller.createStaff);
router.patch("/staff/:id", controller.updateStaff);
router.delete("/staff/:id", controller.deleteStaff);
router.get("/merchants/me", controller.getMerchant);
router.patch("/merchants/me", controller.updateMerchant);
router.get("/api-keys", controller.listApiKeys);
router.post("/api-keys", controller.createApiKey);
router.delete("/api-keys/:id", controller.revokeApiKey);
router.post("/payments/reconcile", controller.reconcilePayments);
router.post("/payments/webhooks/:id/retry", controller.retryPaymentWebhook);
router.get("/inventory", inventoryController.listInventory);
router.post("/inventory", inventoryController.createInventory);
router.get("/inventory/movements", inventoryController.listMovements);
router.patch("/inventory/:id", inventoryController.updateInventory);
router.post("/inventory/:id/adjust", inventoryController.adjustStock);

// ---- Categories ----
router.get("/categories", categoriesController.listCategories);
router.post("/categories", categoriesController.createCategory);
router.patch("/categories/:id", categoriesController.updateCategory);
router.delete("/categories/:id", categoriesController.deleteCategory);
router.post("/categories/reorder", categoriesController.reorderCategories);

// ---- Menu Items ----
router.get("/menu-items", menuItemsController.listMenuItems);
router.post("/menu-items", menuItemsController.createMenuItem);
router.patch("/menu-items/:id", menuItemsController.updateMenuItem);
router.delete("/menu-items/:id", menuItemsController.deleteMenuItem);

// ---- Dining Tables ----
router.get("/tables", tablesController.listTables);
router.post("/tables", tablesController.createTable);
router.delete("/tables/:id", tablesController.deleteTable);
router.post("/tables/:id/regenerate-token", tablesController.regenerateToken);

router.get("/hr/shifts", hrController.listShifts);
router.post("/hr/shifts", hrController.createShift);
router.patch("/hr/shifts/:id", hrController.updateShift);
router.delete("/hr/shifts/:id", hrController.deleteShift);
router.get("/hr/timesheets", hrController.listTimesheets);
router.get("/hr/staff-performance", hrController.staffPerformance);
router.patch("/hr/staff/:id", hrController.updateStaffHr);
router.get("/hr/commissions", hrController.listCommissions);
router.post("/hr/commissions/calculate", hrController.calculateCommissions);
router.patch("/hr/commissions/:id", hrController.updateCommission);

router.get("/analytics/sales-by-product", analyticsController.salesByProduct);
router.get("/analytics/margin", analyticsController.margin);
router.get("/analytics/slow-moving", analyticsController.slowMoving);
router.get("/analytics/turnover", analyticsController.turnover);

router.get("/ecommerce/connections", ecommerceController.listConnections);
router.post("/ecommerce/connections", ecommerceController.createConnection);
router.patch("/ecommerce/connections/:id", ecommerceController.updateConnection);
router.delete("/ecommerce/connections/:id", ecommerceController.deleteConnection);
router.post("/ecommerce/connections/:id/sync", ecommerceController.syncOrders);
router.post("/ecommerce/connections/:id/push-inventory", ecommerceController.pushInventory);
router.get("/ecommerce/orders", ecommerceController.listOrders);
router.get("/ecommerce/orders/:id", ecommerceController.getOrder);
router.patch("/ecommerce/orders/:id/fulfill", ecommerceController.fulfillOrder);

router.get("/click-and-collect", cncController.listReservations);
router.post("/click-and-collect", cncController.createReservation);
router.get("/click-and-collect/:id", cncController.getReservation);
router.post("/click-and-collect/verify", cncController.verifyPickup);
router.post("/click-and-collect/:id/cancel", cncController.cancelReservation);
router.post("/click-and-collect/expire", cncController.expireReservations);

router.get("/accounting/connections", accountingController.listConnections);
router.post("/accounting/connections", accountingController.createConnection);
router.patch("/accounting/connections/:id", accountingController.updateConnection);
router.delete("/accounting/connections/:id", accountingController.deleteConnection);
router.post("/accounting/connections/:id/sync", accountingController.syncJournal);
router.post("/accounting/journal/daily", accountingController.generateDailyJournal);
router.get("/accounting/journal", accountingController.listJournal);
router.get("/accounting/journal/:id", accountingController.getJournal);
router.post("/accounting/journal/:id/post", accountingController.postJournal);
router.post("/accounting/tax-invoices", accountingController.createTaxInvoice);
router.get("/accounting/tax-invoices", accountingController.listTaxInvoices);
router.post("/accounting/tax-invoices/:id/issue", accountingController.issueTaxInvoice);

module.exports = router;