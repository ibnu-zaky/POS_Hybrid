const express = require("express");

const authController = require("../controllers/auth.controller");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const tenantContext = require("../middleware/tenant-context");

const router = express.Router();

router.post("/dev-login", authController.devLogin);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticate, tenantContext, authController.logout);
router.get("/me", authenticate, tenantContext, authorize(["admin", "manager", "cashier"]), authController.me);

module.exports = router;
