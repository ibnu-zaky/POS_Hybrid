// features/kasir/Receipt.tsx
import { Button } from "../../components/ui/Button";
import { formatRp } from "../../lib/money";
import { formatDateTime } from "../../lib/time";
import type { Order } from "../../data/seed";

type Props = {
  order: Order;
  storeName: string;
  onClose: () => void;
  isNew?: boolean;
};

const METHOD_LABEL: Record<string, string> = { tunai: "Tunai", qris: "QRIS", kartu: "Kartu" };

export function Receipt({ order, storeName, onClose, isNew }: Props) {
  const [datePart, timePart] = formatDateTime(order.createdAt).split(", ");

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Struk" onClick={onClose}>
      <div className="dialog box r2 receipt-print" onClick={(e) => e.stopPropagation()}>
        <div className="slip">
          <div className="store">{storeName}</div>
          <div className="small">{isNew ? "Pembayaran berhasil" : "Struk pesanan"}</div>
          <hr />
          <div className="l sub">
            <span>Pesanan #{String(order.number).padStart(3, "0")}</span>
            <span>
              {datePart}, {timePart}
            </span>
          </div>
          <div className="l sub">
            <span>
              {order.tableNo ? `Makan di sini, meja ${order.tableNo}` : "Bawa pulang"}
            </span>
            <span>{order.source === "qr" ? "Dipesan lewat QR" : "Kasir"}</span>
          </div>
          <hr />
          {order.lines.map((line) => (
            <div key={line.productId}>
              <div className="l">
                <span>
                  {line.qty} × {line.name}
                </span>
                <span>{formatRp(line.price * line.qty)}</span>
              </div>
              {line.note && (
                <div className="l sub">
                  <span>Catatan: {line.note}</span>
                </div>
              )}
            </div>
          ))}
          <hr />
          <div className="l sub">
            <span>Subtotal</span>
            <span>{formatRp(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="l sub">
              <span>Diskon</span>
              <span>− {formatRp(order.discount)}</span>
            </div>
          )}
          <div className="l sub">
            <span>PPN</span>
            <span>{formatRp(order.tax)}</span>
          </div>
          <div className="l big">
            <span>Total</span>
            <span>{formatRp(order.total)}</span>
          </div>
          <hr />
          {order.payment.method && (
            <>
              <div className="l sub">
                <span>Metode</span>
                <span>{METHOD_LABEL[order.payment.method] || order.payment.method}</span>
              </div>
              {order.payment.method === "tunai" && order.payment.received ? (
                <>
                  <div className="l sub">
                    <span>Diterima</span>
                    <span>{formatRp(order.payment.received)}</span>
                  </div>
                  <div className="l sub">
                    <span>Kembalian</span>
                    <span>{formatRp(order.payment.received - order.total)}</span>
                  </div>
                </>
              ) : null}
            </>
          )}
          <div className="thanks">Terima kasih, sampai ketemu lagi!</div>
        </div>
        <div className="actions">
          <Button onClick={() => window.print()}>Cetak struk</Button>
          <Button variant="fill" onClick={onClose}>
            {isNew ? "Pesanan baru" : "Tutup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
