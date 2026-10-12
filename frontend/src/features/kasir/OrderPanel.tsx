// features/kasir/OrderPanel.tsx
import { Stepper } from "../../components/ui/Stepper";
import { Button } from "../../components/ui/Button";
import { MoneyText } from "../../components/ui/MoneyText";
import { formatRp } from "../../lib/money";
import type { OrderLine } from "../../data/seed";

type Props = {
  lines: OrderLine[];
  orderNumber: number;
  discountPct: number;
  discountPresets: number[];
  onDiscountChange: (pct: number) => void;
  onQtyChange: (productId: number, qty: number) => void;
  onClear: () => void;
  onPay: () => void;
  taxPct: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export function OrderPanel({
  lines,
  orderNumber,
  discountPct,
  discountPresets,
  onDiscountChange,
  onQtyChange,
  onClear,
  onPay,
  taxPct,
  subtotal,
  discount,
  tax,
  total,
}: Props) {
  return (
    <>
      <div className="t-head">
        <h2>Pesanan #{String(orderNumber).padStart(3, "0")}</h2>
        {lines.length > 0 && (
          <Button variant="link" onClick={onClear}>Kosongkan</Button>
        )}
      </div>

      <div className="items" id="items">
        {lines.length === 0 ? (
          <div className="empty">
            <span className="ic" aria-hidden="true" style={{ fontSize: 48 }}>🍽</span>
            Belum ada pesanan.
            <br />
            Ketuk menu untuk menambahkan.
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.productId} className="line">
              <div>
                <div className="n">{line.name}</div>
                <div className="each">{formatRp(line.price)}</div>
              </div>
              <div className="sub">{formatRp(line.price * line.qty)}</div>
              <Stepper value={line.qty} onChange={(v) => onQtyChange(line.productId, v)} min={0} />
              <div style={{ textAlign: "right" }}>
                <Button variant="link" onClick={() => onQtyChange(line.productId, 0)}>Hapus</Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sum">
        {lines.length > 0 && (
          <div className="disc">
            Diskon{" "}
            {discountPresets.map((pct, i) => (
              <Button
                key={pct}
                variant="small"
                radius={i % 2 ? "r2" : "r1"}
                active={pct === discountPct}
                onClick={() => onDiscountChange(pct)}
                style={{ fontSize: 14 }}
              >
                {pct ? `${pct}%` : "Tanpa"}
              </Button>
            ))}
          </div>
        )}
        <div className="row">
          <span>Subtotal</span>
          <span>{formatRp(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="row">
            <span>Potongan diskon</span>
            <span>− {formatRp(discount)}</span>
          </div>
        )}
        <div className="row">
          <span>PPN {taxPct}%</span>
          <span>{formatRp(tax)}</span>
        </div>
        <div className="total">
          <span>Total</span>
          <MoneyText value={total} size="large" />
        </div>
        <Button variant="fill" onClick={onPay} disabled={lines.length === 0} style={{ minHeight: 54 }}>
          Bayar
        </Button>
      </div>
    </>
  );
}
