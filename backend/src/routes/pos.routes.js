const express = require("express");

const authenticate = require("../middleware/authenticate");
const tenantContext = require("../middleware/tenant-context");
const authorize = require("../middleware/authorize");
const transactionService = require("../services/transaction.service");
const inventoryService = require("../services/inventory.service");
const receiptService = require("../services/receipt.service");
const reportsService = require("../services/reports.service");
const hrService = require("../services/hr.service");
const { clockSchema } = require("../schemas/hr.schema");
const {
  dashboardQuerySchema,
  dailyQuerySchema,
  weeklyQuerySchema,
  monthlyQuerySchema,
} = require("../schemas/reports.schema");
const { createTransactionSchema, updateTransactionSchema } = require("../schemas/pos.schema");

const router = express.Router();

router.use(authenticate, tenantContext);

router.get("/health", authorize(["admin", "manager", "cashier", "integration"]), (_request, response) => {
  response.json({ status: "ok", module: "pos" });
});

router.get("/transactions", authorize(["admin", "manager", "cashier", "integration"]), async (request, response, next) => {
  try {
    const limit = Number(request.query.limit || 20);
    const offset = Number(request.query.offset || 0);
    const merchantId = request.auth.merchant_id;

    const result = await transactionService.listTransactions({ merchantId, limit, offset });
    response.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

router.post("/transactions", authorize(["admin", "manager", "cashier"]), async (request, response, next) => {
  try {
    const headerKey = request.get("Idempotency-Key");
    const payload = createTransactionSchema.parse(
      headerKey ? { ...request.body, idempotency_key: headerKey } : request.body,
    );
    const merchantId = request.auth.merchant_id;
    const staffId = request.auth.sub;

    const result = await transactionService.createTransaction({
      merchantId,
      staffId,
      payload,
    });

    if (result.replayed) {
      return response.status(200).json({ data: result, replayed: true });
    }

    response.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/transactions/:id", authorize(["admin", "manager", "cashier", "integration"]), async (request, response, next) => {
  try {
    const merchantId = request.auth.merchant_id;
    const transaction = await transactionService.getTransactionById({
      merchantId,
      transactionId: request.params.id,
    });

    response.status(200).json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

router.patch("/transactions/:id", authorize(["admin", "manager", "cashier"]), async (request, response, next) => {
  try {
    const payload = updateTransactionSchema.parse(request.body);
    const merchantId = request.auth.merchant_id;
    const staffId = request.auth.sub;

    const result = await transactionService.updateTransaction({
      merchantId,
      transactionId: request.params.id,
      staffId,
      payload,
    });

    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.delete("/transactions/:id", authorize(["admin", "manager"]), async (request, response, next) => {
  try {
    const merchantId = request.auth.merchant_id;
    const result = await transactionService.deleteTransaction({
      merchantId,
      transactionId: request.params.id,
    });

    response.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/transactions/:id/receipt", authorize(["admin", "manager", "cashier", "integration"]), async (request, response, next) => {
  try {
    const format = String(request.query.format || "escpos");
    if (!["escpos", "text", "json"].includes(format)) {
      return response.status(400).json({ error: "format must be one of escpos, text, json" });
    }

    const receipt = await receiptService.getReceipt({
      merchantId: request.auth.merchant_id,
      transactionId: request.params.id,
    });

    if (format === "json") {
      return response.status(200).json({ data: receipt });
    }

    const body = format === "text"
      ? receiptService.formatText(receipt)
      : receiptService.formatEscPos(receipt);

    response.status(200);
    if (format === "text") {
      response.set("Content-Type", "text/plain; charset=utf-8");
      return response.send(body);
    }

    response.set("Content-Type", "application/octet-stream");
    return response.send(Buffer.from(body, "binary"));
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/today", authorize(["admin", "manager", "cashier", "integration"]), async (request, response, next) => {
  try {
    const query = dashboardQuerySchema.parse(request.query);
    const data = await reportsService.getDashboard({
      merchantId: request.auth.merchant_id,
      date: query.date,
      from: query.from,
      to: query.to,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/daily", authorize(["admin", "manager"]), async (request, response, next) => {
  try {
    const query = dailyQuerySchema.parse(request.query);
    const data = await reportsService.getDailyReport({
      merchantId: request.auth.merchant_id,
      date: query.date,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/weekly", authorize(["admin", "manager"]), async (request, response, next) => {
  try {
    const query = weeklyQuerySchema.parse(request.query);
    const data = await reportsService.getWeeklyReport({
      merchantId: request.auth.merchant_id,
      start: query.start,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/monthly", authorize(["admin", "manager"]), async (request, response, next) => {
  try {
    const query = monthlyQuerySchema.parse(request.query);
    const data = await reportsService.getMonthlyReport({
      merchantId: request.auth.merchant_id,
      month: query.month,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.post("/hr/clock-in", authorize(["admin", "manager", "cashier"]), async (request, response, next) => {
  try {
    const payload = clockSchema.parse(request.body || {});
    const data = await hrService.clockIn({
      merchantId: request.auth.merchant_id,
      staffId: request.auth.sub,
      payload,
    });
    response.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

router.post("/hr/clock-out", authorize(["admin", "manager", "cashier"]), async (request, response, next) => {
  try {
    const payload = clockSchema.parse(request.body || {});
    const data = await hrService.clockOut({
      merchantId: request.auth.merchant_id,
      staffId: request.auth.sub,
      payload,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/inventory/availability", authorize(["admin", "manager", "cashier", "integration"]), async (request, response, next) => {
  try {
    const skus = String(request.query.sku || "")
      .split(",")
      .map((sku) => sku.trim())
      .filter(Boolean);

    if (!skus.length) {
      return response.status(400).json({ error: "sku query parameter is required" });
    }
    if (skus.length > 100) {
      return response.status(400).json({ error: "Maximum 100 SKUs per request" });
    }

    const data = await inventoryService.getAvailability({
      merchantId: request.auth.merchant_id,
      skus,
    });
    response.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
