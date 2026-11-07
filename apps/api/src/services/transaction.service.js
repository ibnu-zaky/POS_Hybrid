const crypto = require("crypto");
const { withTenantContext } = require("../config/database");
const transactionRepository = require("../repositories/transaction.repository");
const inventoryService = require("./inventory.service");

class TransactionError extends Error {
  constructor(message = "Transaction error", statusCode = 400) {
    super(message);
    this.name = "TransactionError";
    this.statusCode = statusCode;
  }
}

class TransactionOrderError extends Error {
  constructor(message = "Order error", statusCode = 400) {
    super(message);
    this.name = "TransactionOrderError";
    this.statusCode = statusCode;
  }
}

function computeTotals(items, { discountPct = 0, taxPct = 11 } = {}) {
  const normalized = (items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const itemSubtotal = quantity * unitPrice;
    const discountAmount = Math.min(itemSubtotal, Math.round(Number(item.discount_amount || 0)));

    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      line_total: itemSubtotal - discountAmount,
    };
  });

  const subtotal = normalized.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const itemDiscount = normalized.reduce((sum, item) => sum + item.discount_amount, 0);
  const amountAfterItemDiscounts = subtotal - itemDiscount;
  const percentageDiscount = Math.round(amountAfterItemDiscounts * discountPct / 100);
  let distributedDiscount = 0;
  normalized.forEach((item, index) => {
    const allocatedDiscount = index === normalized.length - 1
      ? percentageDiscount - distributedDiscount
      : amountAfterItemDiscounts === 0
        ? 0
        : Math.floor(item.line_total * percentageDiscount / amountAfterItemDiscounts);
    item.line_total -= allocatedDiscount;
    distributedDiscount += allocatedDiscount;
  });
  const discountAmount = itemDiscount + percentageDiscount;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxPct / 100);
  const grandTotal = taxableAmount + taxAmount;

  return {
    items: normalized,
    subtotal,
    taxAmount,
    grandTotal,
    discountAmount,
  };
}

async function resolveOrderItems(client, merchantId, items) {
  const menuItemIds = [...new Set(items.map((item) => item.menu_item_id).filter(Boolean))];
  const catalogRows = menuItemIds.length
    ? await transactionRepository.getMenuItemsForOrder(client, { merchantId, menuItemIds })
    : [];
  const catalogById = new Map(catalogRows.map((item) => [item.id, item]));
  if (catalogRows.length !== menuItemIds.length) {
    throw new TransactionError("One or more menu items were not found", 404);
  }

  return items.map((item) => {
    if (!item.menu_item_id) {
      return { ...item, unit_price: Math.round(Number(item.unit_price)) };
    }
    const menuItem = catalogById.get(item.menu_item_id);
    if (!menuItem.is_active || !menuItem.is_available) {
      throw new TransactionError(`Menu item is unavailable: ${menuItem.name}`, 409);
    }
    return {
      ...item,
      menu_item_id: menuItem.id,
      product_name: menuItem.name,
      sku: menuItem.sku,
      unit_price: menuItem.price,
      discount_amount: 0,
    };
  });
}

async function listTransactions({ merchantId, limit = 20, offset = 0 }) {
  return withTenantContext(merchantId, async (client) => {
    const [rows, total] = await Promise.all([
      transactionRepository.listByMerchant(client, { merchantId, limit: Number(limit), offset: Number(offset) }),
      transactionRepository.countByMerchant(client, merchantId),
    ]);

    return {
      data: rows,
      meta: {
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        limit: Number(limit),
        offset: Number(offset),
        total,
      },
    };
  });
}

async function getTransactionById({ merchantId, transactionId }) {
  if (!transactionId) {
    throw new TransactionError("Transaction id is required", 400);
  }

  return withTenantContext(merchantId, async (client) => {
    const transaction = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!transaction) {
      throw new TransactionError("Transaction not found", 404);
    }

    const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
    return { ...transaction, items };
  });
}

async function createTransaction({ merchantId, staffId, payload }) {
  if (!merchantId || (payload?.source !== "qr" && !staffId)) {
    throw new TransactionError("Merchant and staff context required", 400);
  }

  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    throw new TransactionError("Transaction items are required", 400);
  }

  const orderNumber = payload.order_number || `POS-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const paymentMethod = payload.payment_method || "cash";
  const idempotencyKey = payload.idempotency_key || null;

  return withTenantContext(merchantId, async (client) => {
    if (idempotencyKey) {
      const replay = await transactionRepository.findByIdempotencyKey(client, { merchantId, idempotencyKey });
      if (replay) {
        const replayItems = await transactionRepository.findItemsByTransactionId(client, replay.id);
        return { ...replay, items: replayItems, replayed: true };
      }
    }

    const itemsForOrder = await resolveOrderItems(client, merchantId, payload.items);
    const totals = computeTotals(itemsForOrder, {
      discountPct: Number(payload.discount_pct || 0),
      taxPct: Number(payload.tax_pct ?? 11),
    });
    const isQrOrder = payload.source === "qr";
    const amountPaid = isQrOrder ? 0 : Number(payload.amount_paid ?? totals.grandTotal);
    const table = payload.table_id
      ? await transactionRepository.findTableForOrder(client, { merchantId, tableId: payload.table_id })
      : null;
    if (payload.table_id && !table) {
      throw new TransactionError("Active dining table not found", 404);
    }
    const dailyCounter = await transactionRepository.getNextDailyNumber(client, merchantId);
    const paymentStatus = isQrOrder ? "unpaid" : amountPaid >= totals.grandTotal ? "paid" : "unpaid";

    let transaction;
    try {
      transaction = await transactionRepository.create(client, {
        merchant_id: merchantId,
        staff_id: staffId || null,
        order_number: orderNumber,
        status: isQrOrder ? "draft" : "completed",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        grand_total: totals.grandTotal,
        amount_paid: amountPaid,
        change_amount: Math.max(0, amountPaid - totals.grandTotal),
        payment_method: paymentMethod,
        notes: payload.notes || null,
        idempotency_key: idempotencyKey,
        source: payload.source || "kasir",
        order_type: payload.order_type || "dine",
        table_id: table?.id || null,
        table_number: table?.number ?? null,
        customer_name: payload.customer_name || null,
        fulfillment_status: isQrOrder ? "baru" : "selesai",
        daily_number: dailyCounter.last_number,
        daily_date: dailyCounter.counter_date,
        discount_pct: Number(payload.discount_pct || 0),
        tax_pct: Number(payload.tax_pct ?? 11),
        public_token: isQrOrder ? crypto.randomBytes(24).toString("base64url") : null,
        payment_status: paymentStatus,
      });
    } catch (error) {
      // Race: retry offline yang sama-sama lolos check → unique violation 23505
      if (error.code === "23505" && idempotencyKey) {
        const replay = await transactionRepository.findByIdempotencyKey(client, { merchantId, idempotencyKey });
        if (replay) {
          const replayItems = await transactionRepository.findItemsByTransactionId(client, replay.id);
          return { ...replay, items: replayItems, replayed: true };
        }
      }
      throw error;
    }

    const items = totals.items.map((item) => ({
      ...item,
      product_id: item.product_id,
      menu_item_id: item.menu_item_id,
      product_name: item.product_name || "Product",
      sku: item.sku || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      line_total: item.line_total,
    }));

    await transactionRepository.insertItems(client, transaction.id, items);

    if (!isQrOrder) {
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items,
        sign: -1,
        type: "sale",
        transactionId: transaction.id,
        createdBy: staffId,
      });
    }

    return {
      ...transaction,
      items,
    };
  });
}

async function updateTransaction({ merchantId, transactionId, staffId, payload }) {
  if (!transactionId) {
    throw new TransactionError("Transaction id is required", 400);
  }

  return withTenantContext(merchantId, async (client) => {
    const existing = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!existing) {
      throw new TransactionError("Transaction not found", 404);
    }

    const updates = {};
    if (payload.status) updates.status = payload.status;
    if (payload.notes !== undefined) updates.notes = payload.notes;
    if (payload.payment_method) updates.payment_method = payload.payment_method;
    if (payload.amount_paid !== undefined) updates.amount_paid = Number(payload.amount_paid);

    if (payload.items && Array.isArray(payload.items) && payload.items.length) {
      const previousItems = await transactionRepository.findItemsByTransactionId(client, transactionId);
      const resolvedItems = await resolveOrderItems(client, merchantId, payload.items);
      const totals = computeTotals(resolvedItems, {
        discountPct: Number(existing.discount_pct || 0),
        taxPct: Number(existing.tax_pct ?? 11),
      });
      updates.subtotal = totals.subtotal;
      updates.discount_amount = totals.discountAmount;
      updates.tax_amount = totals.taxAmount;
      updates.grand_total = totals.grandTotal;
      updates.amount_paid = Number(payload.amount_paid ?? updates.amount_paid ?? existing.amount_paid ?? totals.grandTotal);
      updates.change_amount = Math.max(0, Number(updates.amount_paid) - Number(totals.grandTotal));

      await transactionRepository.replaceItems(client, transactionId, totals.items.map((item) => ({
        ...item,
        menu_item_id: item.menu_item_id || null,
        product_name: item.product_name || "Product",
        sku: item.sku || null,
      })));

      // Restock item lama dulu (menghindari oversell sementara saat SKU sama),
      // baru deduct item baru — dalam satu transaksi DB.
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items: previousItems,
        sign: 1,
        type: "restock",
        transactionId,
        createdBy: staffId,
      });
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items: totals.items,
        sign: -1,
        type: "sale",
        transactionId,
        createdBy: staffId,
      });
    }

    const updated = await transactionRepository.update(client, {
      merchantId,
      transactionId,
      updates,
    });

    if (!updated) {
      throw new TransactionError("Transaction could not be updated", 400);
    }

    const items = payload.items && Array.isArray(payload.items) && payload.items.length
      ? await transactionRepository.findItemsByTransactionId(client, transactionId)
      : await transactionRepository.findItemsByTransactionId(client, transactionId);

    return { ...updated, items, staff_id: staffId || updated.staff_id };
  });
}

async function deleteTransaction({ merchantId, transactionId }) {
  if (!transactionId) {
    throw new TransactionError("Transaction id is required", 400);
  }

  return withTenantContext(merchantId, async (client) => {
    const existing = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!existing) {
      throw new TransactionError("Transaction not found", 404);
    }

    // Sudah void → idempoten, tidak restock ganda.
    if (existing.status === "voided") {
      return { voided: true, id: transactionId, status: "voided", voided_at: existing.voided_at };
    }

    // Transaksi lunas via pembayaran (paid/refunded) tidak boleh di-void (gunakan refund).
    if (existing.status === "paid" || existing.status === "refunded") {
      throw new TransactionError("Transaksi sudah lunas, tidak dapat di-void", 409);
    }

    const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
    await inventoryService.applyStockDeltas(client, {
      merchantId,
      items,
      sign: 1,
      type: "void",
      transactionId,
    });

    const voided = await transactionRepository.markVoided(client, { merchantId, transactionId, reason: null });
    return { voided: true, id: transactionId, status: "voided", voided_at: voided.voided_at };
  });
}

async function listOrders({ merchantId, filters, status, source, table_id, limit, offset, since }) {
  return withTenantContext(merchantId, async (client) => {
    const conditions = ["merchant_id = $1"];
    const params = [merchantId];
    let paramIndex = 2;

    const addCondition = (sql, value) => {
      if (value === undefined || value === null || value === "") return;
      conditions.push(sql.replace("$N", `$${paramIndex++}`));
      params.push(value);
    };

    // Filter chip array: [{ key, value, operator }]
    if (Array.isArray(filters) && filters.length) {
      for (const f of filters) {
        if (!f.value) continue;
        const op = f.operator === "ne" ? "<>" : "=";
        addCondition(`${f.key} = $N`, f.value);
        // NOTE: operator not applied to the placeholder above; handled inline below
        conditions[conditions.length - 1] = `${f.key} ${op} $${paramIndex - 1}`;
      }
    }

    addCondition("status = $N", status);
    addCondition("source = $N", source);
    addCondition("table_id = $N", table_id);
    addCondition("fulfillment_status = $N", filters?.[0]?.key === "fulfillment_status" ? filters[0].value : undefined);

    if (since) {
      const sinceDate = new Date(Number(since));
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(`created_at > $${paramIndex++}`);
        params.push(sinceDate);
      }
    }

    const whereClause = conditions.join(" AND ");
    const sql = `SELECT id, order_number, merchant_id, staff_id, status, subtotal, discount_amount, tax_amount, grand_total, amount_paid, change_amount, payment_method, payment_status, paid_at, notes, idempotency_key, source, order_type, table_id, table_number, customer_name, fulfillment_status, reject_reason, daily_number, daily_date, discount_pct, tax_pct, public_token, created_at, updated_at FROM transactions WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const { rows: orders } = await client.query(sql, params);
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM transactions WHERE ${whereClause}`,
      params.slice(0, params.length - 2),
    );
    const total = countRows[0]?.total || 0;

    return {
      data: orders,
      meta: {
        limit,
        offset,
        total,
      },
    };
  });
}

async function updateFulfillmentStatus({ merchantId, transactionId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!existing) throw new TransactionOrderError("Order not found", 404);

    const newStatus = payload.fulfillment_status;
    const rejectReason = payload.reject_reason;
    const prevStatus = existing.fulfillment_status;

    const order = ["baru", "diterima", "diproses", "siap", "selesai"];
    const linearTransitions = {};
    for (let i = 0; i < order.length; i++) {
      linearTransitions[order[i]] = order.slice(i + 1);
    }
    linearTransitions["ditolak"] = [];
    for (const key of order) {
      linearTransitions[key].push("ditolak");
    }

    if (newStatus && !linearTransitions[prevStatus]?.includes(newStatus)) {
      throw new TransactionOrderError(`Invalid fulfillment status transition: ${prevStatus} -> ${newStatus}`, 409);
    }
    if (newStatus === "selesai" && existing.payment_status !== "paid") {
      throw new TransactionOrderError("Cannot finish order without payment", 409);
    }

    const updates = {};
    if (newStatus) updates.fulfillment_status = newStatus;
    if (rejectReason) updates.reject_reason = rejectReason;
    if (!Object.keys(updates).length) throw new TransactionOrderError("No status updates", 400);

    // Stock deduction on entering diterima
    if (newStatus === "diterima") {
      const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items,
        sign: -1,
        type: "sale",
        transactionId,
        createdBy: existing.staff_id,
      });
    }

    // Restock on rejection if stock was deducted earlier
    if (newStatus === "ditolak" && prevStatus && ["diterima", "diproses", "siap"].includes(prevStatus)) {
      const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
      await inventoryService.applyStockDeltas(client, {
        merchantId,
        items,
        sign: 1,
        type: "restock",
        transactionId,
        createdBy: existing.staff_id,
      });
    }

    const updated = await transactionRepository.update(client, { merchantId, transactionId, updates });
    const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
    return { ...updated, items };
  });
}

async function manualPay({ merchantId, transactionId, staffId, payload }) {
  return withTenantContext(merchantId, async (client) => {
    const existing = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!existing) throw new TransactionOrderError("Order not found", 404);
    if (existing.payment_status === "paid" || existing.payment_status === "refunded") throw new TransactionOrderError("Order already paid or refunded", 409);

    const amountPaid = Number(payload.amount_paid);
    const grandTotal = Number(existing.grand_total);
    if (amountPaid < grandTotal) throw new TransactionOrderError("Insufficient payment", 409);

    const changeAmount = Math.max(0, amountPaid - grandTotal);

    const updates = {
      payment_status: "paid",
      payment_method: payload.payment_method,
      payment_provider: "manual",
      amount_paid: amountPaid,
      change_amount: changeAmount,
      paid_at: new Date().toISOString(),
    };

    // Kasir menerima pembayaran QR draft → transaksi berubah jadi completed.
    if (existing.status === "draft") {
      updates.status = "completed";
    }

    const updated = await transactionRepository.update(client, { merchantId, transactionId, updates });
    const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
    return { ...updated, items };
  });
}

module.exports = {
  TransactionError,
  TransactionOrderError,
  computeTotals,
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listOrders,
  updateFulfillmentStatus,
  manualPay,
};
