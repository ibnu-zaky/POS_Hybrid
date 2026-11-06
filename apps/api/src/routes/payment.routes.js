const express = require("express");
const authenticate = require("../middleware/authenticate");
const tenantContext = require("../middleware/tenant-context");
const authorize = require("../middleware/authorize");
const controller = require("../controllers/payment.controller");

const router = express.Router();
router.use(authenticate, tenantContext, authorize(["admin", "manager", "cashier"]));
router.post("/transactions/:id/payments", controller.create);
router.get("/payments/:id", controller.get);
router.post("/payments/:id/cancel", controller.cancel);
router.post("/payments/:id/refund", authorize(["admin", "manager"]), controller.refund);

module.exports = router;