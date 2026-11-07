/**
 * Uang di aplikasi selalu integer rupiah. Dilarang float untuk nilai uang.
 * Pembulatan wajib half-away-from-zero: Math.round(-2.5) === -2 dilarang.
 */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** Pembulatan 2 desimal (dipakai nilai non-rupiah seperti persentase/akuntansi). */
export function round2(value: number): number {
  return roundHalfUp(value * 100) / 100;
}

/**
 * Konversi nilai NUMERIC dari DB ke integer rupiah.
 * Melempar error bila ada pecahan atau nilai bukan angka — tidak boleh
 * "diperbaiki diam-diam" dengan parseFloat longgar.
 */
export function toRupiah(value: string | number): number {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) throw new Error("Invalid rupiah value");
  if (!Number.isInteger(num)) throw new Error("Rupiah value must be integer");
  return num;
}

/** Persen dari nilai uang, aritmetika integer bila memungkinkan. */
export function percentOf(amount: number, percent: number): number {
  if (Number.isInteger(amount) && Number.isInteger(percent)) {
    const product = amount * percent;
    const abs = Math.abs(product);
    // half-up: floor((abs*2 + 100) / 200)
    const rounded = Math.floor((abs * 2 + 100) / 200);
    return Math.sign(product) * rounded;
  }
  return roundHalfUp((amount * percent) / 100);
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
    const discountAmount = Math.min(itemSubtotal, roundHalfUp(Number(item.discount_amount || 0)));
    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      line_total: itemSubtotal - discountAmount,
    } as NormalizedOrderItem;
  });

  const subtotal = normalized.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const itemDiscount = normalized.reduce((sum, item) => sum + item.discount_amount, 0);
  const amountAfterItemDiscounts = subtotal - itemDiscount;
  const percentageDiscount = percentOf(amountAfterItemDiscounts, discountPct);

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
  const taxAmount = percentOf(taxableAmount, taxPct ?? 11);
  const grandTotal = taxableAmount + taxAmount;

  return {
    items: normalized,
    subtotal,
    taxAmount,
    grandTotal,
    discountAmount,
  };
}