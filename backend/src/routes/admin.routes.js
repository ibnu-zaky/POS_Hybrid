const express = require("express");
const authenticate = require("../middleware/authenticate");
const tenantContext = require("../middleware/tenant-context");
const authorize = require("../middleware/authorize");
const controller = require("../controllers/admin.controller");
const inventoryController = require("../controllers/inventory.controller");
const hrController = require("../controllers/hr.controller");
const analyticsController = require("../controllers/analytics.controller");

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

module.exports = router;