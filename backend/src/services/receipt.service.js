const { withTenantContext } = require("../config/database");
const transactionRepository = require("../repositories/transaction.repository");
const merchantRepository = require("../repositories/merchant.repository");
const staffRepository = require("../repositories/staff.repository");

class ReceiptError extends Error {
  constructor(message = "Receipt error", statusCode = 400) {
    super(message);
    this.name = "ReceiptError";
    this.statusCode = statusCode;
  }
}

const RECEIPT_WIDTH = 42;
const DASHES = "-".repeat(RECEIPT_WIDTH);

function formatCurrency(value) {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

  return formatted.replace(/\u00a0/g, "");
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toISOString().replace("T", " ").substring(0, 16);
}

function center(text) {
  const padding = Math.max(0, Math.floor((RECEIPT_WIDTH - text.length) / 2));
  return " ".repeat(padding) + text;
}

function truncate(text, width) {
  const value = String(text || "");
  return value.length > width ? `${value.slice(0, width - 1)}…` : value;
}

function row(label, amount) {
  const labelWidth = RECEIPT_WIDTH - amount.length;
  return label.length >= labelWidth ? `${label} ${amount}` : label.padEnd(labelWidth) + amount;
}

function itemRow(item) {
  const name = truncate(item.product_name || "Item", 26);
  const qty = `x${Number(item.quantity || 0)}`;
  const lineTotal = formatCurrency(item.line_total);
  const left = `${name} ${qty.padStart(4)}`;
  return lineTotal.length >= RECEIPT_WIDTH ? lineTotal : left + lineTotal.padStart(RECEIPT_WIDTH - left.length);
}

async function getReceipt({ merchantId, transactionId }) {
  if (!merchantId || !transactionId) {
    throw new ReceiptError("Merchant and transaction context required", 400);
  }

  return withTenantContext(merchantId, async (client) => {
    const transaction = await transactionRepository.findById(client, { merchantId, transactionId });
    if (!transaction) {
      throw new ReceiptError("Transaction not found", 404);
    }

    const [items, merchant, staff] = await Promise.all([
      transactionRepository.findItemsByTransactionId(client, transactionId),
      merchantRepository.findById(client, merchantId),
      transaction.staff_id
        ? staffRepository.findById(client, merchantId, transaction.staff_id)
        : Promise.resolve(null),
    ]);

    return {
      merchant_name: merchant?.name || "POS Hybrid",
      cashier_name: staff?.name || null,
      date: transaction.created_at,
      transaction_id: transaction.id,
      transaction_ref: transaction.id.substring(0, 8),
      order_number: transaction.order_number,
      status: transaction.status,
      subtotal: Number(transaction.subtotal),
      discount: Number(transaction.discount_amount || 0),
      tax: Number(transaction.tax_amount || 0),
      total: Number(transaction.grand_total),
      amount_paid: Number(transaction.amount_paid || 0),
      change: Number(transaction.change_amount || 0),
      payment_method: transaction.payment_method,
      payment_status: transaction.payment_status,
      items: items.map((item) => ({
        product_name: item.product_name || "Item",
        sku: item.sku,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_amount: Number(item.discount_amount || 0),
        line_total: Number(item.line_total),
      })),
      receipt_url: `https://receipts.pos-hybrid.com/${transaction.id}`,
    };
  });
}

function buildLines(receipt) {
  const lines = [
    { text: truncate(receipt.merchant_name, RECEIPT_WIDTH), align: "center", bold: true },
    { text: "--- RECEIPT ---", align: "center" },
    { text: `Date: ${formatDate(receipt.date)}` },
    { text: `Cashier: ${receipt.cashier_name || "-"}` },
    { text: `Trans ID: ${receipt.transaction_ref}` },
    { text: `Order: ${receipt.order_number}` },
    { text: DASHES },
    { text: `${"DESCRIPTION".padEnd(26)}${"QTY".padStart(4)}${"PRICE".padStart(12)}` },
    { text: DASHES },
  ];

  for (const item of receipt.items) {
    lines.push({ text: truncate(item.product_name || "Item", RECEIPT_WIDTH) });
    lines.push({ text: itemRow(item) });
  }

  lines.push({ text: DASHES });
  lines.push({ text: row("Subtotal:", formatCurrency(receipt.subtotal)) });
  lines.push({ text: row("Tax:", formatCurrency(receipt.tax)) });
  lines.push({ text: row("Discount:", formatCurrency(receipt.discount)) });
  lines.push({ text: row("TOTAL:", formatCurrency(receipt.total)), bold: true });
  lines.push({ text: DASHES });
  lines.push({ text: `Payment: ${receipt.payment_method || "-"}` });
  lines.push({ text: row("Paid:", formatCurrency(receipt.amount_paid)) });
  lines.push({ text: row("Change:", formatCurrency(receipt.change)) });
  lines.push({ text: DASHES });
  lines.push({ text: "Thank You!", align: "center" });
  lines.push({ text: truncate(receipt.receipt_url, RECEIPT_WIDTH), align: "center" });

  return lines;
}

function formatText(receipt) {
  return `${buildLines(receipt).map((line) => line.text).join("\n")}\n`;
}

function toEscPos(lines) {
  const commands = ["\x1b@"];

  for (const line of lines) {
    if (line.align === "center") {
      commands.push("\x1b\x61\x01");
    }
    if (line.bold) {
      commands.push("\x1b\x45\x01");
    }

    commands.push(`${line.text}\n`);

    if (line.bold) {
      commands.push("\x1b\x45\x00");
    }
    if (line.align === "center") {
      commands.push("\x1b\x61\x00");
    }
  }

  commands.push("\x1b\x64\x04");
  commands.push("\x1d\x56\x42\x03");
  return commands.join("");
}

function formatEscPos(receipt) {
  return toEscPos(buildLines(receipt));
}

module.exports = {
  ReceiptError,
  getReceipt,
  formatText,
  formatEscPos,
  formatCurrency,
};
