/**
 * Uang di aplikasi selalu integer rupiah.
 * Pembulatan wajib half-away-from-zero: Math.round(-2.5) === -2 dilarang.
 */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

export function round2(value: number): number {
  return roundHalfUp(value * 100) / 100;
}

export function toRupiah(value: string | number): number {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) throw new Error("Invalid rupiah value");
  return roundHalfUp(num);
}

export interface OrderItem {
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  line_total?: number;
  [key: string]: unknown;
}

export interface NormalizedOrderItem extends OrderItem {
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface ComputeTotalsOptions {
  discountPct?: number;
  taxPct?: number;
}

// Perilaku identik dengan versi JS lama (dipakai test lama lewat re-export).
export function computeTotals(items: OrderItem[], { discountPct = 0, taxPct = 11 }: ComputeTotalsOptions = {}) {
  const normalized: NormalizedOrderItem[] = (items || []).map((item) => {
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
    } as NormalizedOrderItem;
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
