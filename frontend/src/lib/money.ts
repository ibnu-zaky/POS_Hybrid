// money.ts — aturan hitung & format rupiah
export function formatRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** format ringkas untuk label grafik: Rp 1,2 jt / Rp 85 rb */
export function formatShortRp(v: number): string {
  if (v >= 1e6) return "Rp " + (v / 1e6).toFixed(1).replace(".", ",") + " jt";
  if (v >= 1e3) return "Rp " + Math.round(v / 1e3) + " rb";
  return "Rp " + v;
}

export function calcOrder(
  lines: { price: number; qty: number }[],
  discountPct: number,
  taxPct: number
) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = Math.round((subtotal * discountPct) / 100);
  const ppn = Math.round(((subtotal - discount) * taxPct) / 100);
  const total = subtotal - discount + ppn;
  return { subtotal, discount, tax: ppn, total };
}

export function calcChange(received: number, total: number): number {
  return received - total;
}
