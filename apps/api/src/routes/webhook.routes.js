const express = require("express");
const controller = require("../controllers/webhook.controller");

const router = express.Router();
router.post("/completion", controller.completion);

module.exports = router;