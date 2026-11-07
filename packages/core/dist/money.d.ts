/**
 * Uang di aplikasi selalu integer rupiah.
 * Pembulatan wajib half-away-from-zero: Math.round(-2.5) === -2 dilarang.
 */
export declare function roundHalfUp(value: number): number;
export declare function round2(value: number): number;
export declare function toRupiah(value: string | number): number;
export interface OrderItem {
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    line_total?: number;
    [key: string]: unknown;
}
export interface ComputeTotalsOptions {
    discountPct?: number;
    taxPct?: number;
}
export declare function computeTotals(items: OrderItem[], { discountPct, taxPct }?: ComputeTotalsOptions): {
    items: {
        quantity: number;
        unit_price: number;
        discount_amount: number;
        line_total: number;
    }[];
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    discountAmount: number;
};
