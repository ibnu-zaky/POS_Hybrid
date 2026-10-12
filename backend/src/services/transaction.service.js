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

function calculateLineTotal(item) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);
  const discountAmount = Number(item.discount_amount || 0);
  const subtotal = quantity * unitPrice;
  return Math.max(0, subtotal - discountAmount);
}

function computeTotals(items) {
  const normalized = (items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const discountAmount = Number(item.discount_amount || 0);
    const lineTotal = calculateLineTotal(item);

    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      line_total: lineTotal,
    };
  });

  const subtotal = normalized.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const taxAmount = subtotal * 0.11;
  const grandTotal = subtotal + taxAmount;

  return {
    items: normalized,
    subtotal,
    taxAmount,
    grandTotal,
    discountAmount: normalized.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0),
  };
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
  if (!merchantId || !staffId) {
    throw new TransactionError("Merchant and staff context required", 400);
  }

  if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
    throw new TransactionError("Transaction items are required", 400);
  }

  const totals = computeTotals(payload.items);
  const orderNumber = payload.order_number || `POS-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const amountPaid = Number(payload.amount_paid ?? totals.grandTotal);
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

    let transaction;
    try {
      transaction = await transactionRepository.create(client, {
        merchant_id: merchantId,
        staff_id: staffId,
        order_number: orderNumber,
        status: "completed",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        grand_total: totals.grandTotal,
        amount_paid: amountPaid,
        change_amount: Math.max(0, amountPaid - totals.grandTotal),
        payment_method: paymentMethod,
        notes: payload.notes || null,
        idempotency_key: idempotencyKey,
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
      product_name: item.product_name || "Product",
      sku: item.sku || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      line_total: item.line_total,
    }));

    await transactionRepository.insertItems(client, transaction.id, items);

    await inventoryService.applyStockDeltas(client, {
      merchantId,
      items,
      sign: -1,
      type: "sale",
      transactionId: transaction.id,
      createdBy: staffId,
    });

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
      const totals = computeTotals(payload.items);
      updates.subtotal = totals.subtotal;
      updates.discount_amount = totals.discountAmount;
      updates.tax_amount = totals.taxAmount;
      updates.grand_total = totals.grandTotal;
      updates.amount_paid = Number(payload.amount_paid ?? updates.amount_paid ?? existing.amount_paid ?? totals.grandTotal);
      updates.change_amount = Math.max(0, Number(updates.amount_paid) - Number(totals.grandTotal));

      await transactionRepository.replaceItems(client, transactionId, totals.items.map((item) => ({
        ...item,
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

    const items = await transactionRepository.findItemsByTransactionId(client, transactionId);
    await inventoryService.applyStockDeltas(client, {
      merchantId,
      items,
      sign: 1,
      type: "restock",
      transactionId,
    });

    const removed = await transactionRepository.remove(client, { merchantId, transactionId });
    return { deleted: removed, id: transactionId };
  });
}

module.exports = {
  TransactionError,
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
