// features/customer/CartSheet.tsx — sheet pesanan naik dari bawah
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Stepper } from "../../components/ui/Stepper";
import { Field } from "../../components/ui/Field";
import { formatRp } from "../../lib/money";
import { escapeHtml } from "../../lib/csv";
import { useStore } from "../../state/store-context";
import type { Order } from "../../data/seed";

type CartLine = { productId: number; name: string; price: number; qty: number };

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  onQtyChange: (productId: number, qty: number) => void;
  onNoteChange: (productId: number, note: string) => void;
  subtotal: number;
  tax: number;
  total: number;
  taxPct: number;
  onClear: () => void;
  tableNumber: number;
  onOrdered: (orderId: number) => void;
};

export function CartSheet({
  open,
  onClose,
  lines,
  onQtyChange,
  subtotal,
  tax,
  total,
  taxPct,
  onClear,
  tableNumber,
  onOrdered,
}: Props) {
  const { state, dispatch } = useStore();
  const [notes, setNotes] = useState<Map<number, string>>(new Map());
  const [customerName, setCustomerName] = useState("");
  const [payMethod, setPayMethod] = useState<"kasir" | "qris">("kasir");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const isEmpty = lines.length === 0;

  function handleSend() {
    if (isEmpty) return;
    setSending(true);

    const order: Order = {
      id: state.nextOrderId,
      number: state.nextOrderId,
      source: "qr",
      type: "dine",
      tableNo: tableNumber,
      customerName: customerName ? escapeHtml(customerName) : undefined,
      lines: lines.map((l) => ({
        ...l,
        note: notes.get(l.productId) ? escapeHtml(notes.get(l.productId)!) : undefined,
      })),
      subtotal,
      discount: 0,
      tax,
      total,
      status: "baru",
      payment: {
        status: "belum",
        qrisPending: payMethod === "qris",
        method: payMethod === "qris" ? "qris" : undefined,
      },
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_ORDER", payload: order });
    setSending(false);
    onOrdered(order.id);
  }

  return (
    <div className="sheetwrap" role="dialog" aria-modal="true" aria-label="Pesanan Anda" onClick={onClose}>
      <div className="sheet box" onClick={(e) => e.stopPropagation()}>
        <h2>Pesanan Anda</h2>

        {lines.map((line) => (
          <div key={line.productId} className="cline">
            <div className="top">
              <span>{line.name}</span>
              <span>{formatRp(line.price * line.qty)}</span>
            </div>
            <div className="top">
              <Stepper value={line.qty} onChange={(v) => onQtyChange(line.productId, v)} min={0} name={line.name} />
              <span className="dim">{formatRp(line.price)}</span>
            </div>
            <label className="noteinp box r3">
              <input
                type="text"
                maxLength={60}
                placeholder="Catatan, misalnya tanpa gula"
                value={notes.get(line.productId) || ""}
                onChange={(e) => {
                  const next = new Map(notes);
                  next.set(line.productId, e.target.value);
                  setNotes(next);
                }}
                aria-label={`Catatan untuk ${line.name}`}
              />
            </label>
          </div>
        ))}

        <Field
          label="Nama pemesan (boleh dikosongkan)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          maxLength={24}
          style={{ marginTop: 12 }}
        />

        <div className="row">
          <span>Subtotal</span>
          <span>{formatRp(subtotal)}</span>
        </div>
        <div className="row">
          <span>PPN {taxPct}%</span>
          <span>{formatRp(tax)}</span>
        </div>
        <div className="total">
          <span>Total</span>
          <span>{formatRp(total)}</span>
        </div>

        <div className="paypref">
          <Button active={payMethod === "kasir"} onClick={() => setPayMethod("kasir")}>
            Bayar di kasir
          </Button>
          <Button radius="r2" active={payMethod === "qris"} onClick={() => setPayMethod("qris")}>
            Bayar dengan QRIS
          </Button>
        </div>

        <div className="actions">
          <Button onClick={() => { onClear(); onClose(); }}>Batal</Button>
          <Button
            variant="fill"
            onClick={handleSend}
            disabled={isEmpty || sending}
          >
            {sending ? "Mengirim..." : "Kirim pesanan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
