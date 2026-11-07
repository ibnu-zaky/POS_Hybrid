"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundHalfUp = roundHalfUp;
exports.round2 = round2;
exports.toRupiah = toRupiah;
exports.computeTotals = computeTotals;
/**
 * Uang di aplikasi selalu integer rupiah.
 * Pembulatan wajib half-away-from-zero: Math.round(-2.5) === -2 dilarang.
 */
function roundHalfUp(value) {
    return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
function round2(value) {
    return roundHalfUp(value * 100) / 100;
}
function toRupiah(value) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (Number.isNaN(num))
        throw new Error("Invalid rupiah value");
    return roundHalfUp(num);
}
// Perilaku identik dengan versi JS lama (dipakai test lama lewat re-export).
function computeTotals(items, { discountPct = 0, taxPct = 11 } = {}) {
    const normalized = (items || []).map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const itemSubtotal = quantity * unitPrice;
        // Original used Math.round for individual discount amount. We'll use roundHalfUp.
        const discountAmount = Math.min(itemSubtotal, roundHalfUp(Number(item.discount_amount || 0)));
        return {
            ...item,
            quantity,
            unit_price: unitPrice,
            discount_amount: discountAmount,
            line_total: itemSubtotal - discountAmount,
        };
    });
    const subtotal = normalized.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const itemDiscount = normalized.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const amountAfterItemDiscounts = subtotal - itemDiscount;
    const percentageDiscount = roundHalfUp(amountAfterItemDiscounts * (discountPct || 0) / 100);
    let distributedDiscount = 0;
    normalized.forEach((item, index) => {
        const allocatedDiscount = index === normalized.length - 1
            ? percentageDiscount - distributedDiscount
            : amountAfterItemDiscounts === 0
                ? 0
                : Math.floor((item.line_total || 0) * percentageDiscount / amountAfterItemDiscounts);
        if (item.line_total !== undefined) {
            item.line_total -= allocatedDiscount;
        }
        distributedDiscount += allocatedDiscount;
    });
    const discountAmount = itemDiscount + percentageDiscount;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = roundHalfUp(taxableAmount * (taxPct ?? 11) / 100);
    const grandTotal = taxableAmount + taxAmount;
    return {
        items: normalized,
        subtotal,
        taxAmount,
        grandTotal,
        discountAmount,
    };
}
