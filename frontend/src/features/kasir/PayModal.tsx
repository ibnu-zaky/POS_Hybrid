// features/kasir/PayModal.tsx
import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { formatRp, calcChange } from "../../lib/money";
import { generateQR } from "../../lib/qr";

type Props = {
  open: boolean;
  onClose: () => void;
  total: number;
  onPay: (method: "tunai" | "qris" | "kartu", received?: number) => void;
};

const METHOD_LABEL: Record<string, string> = { tunai: "Tunai", qris: "QRIS", kartu: "Kartu" };

export function PayModal({ open, onClose, total, onPay }: Props) {
  const [method, setMethod] = useState<"tunai" | "qris" | "kartu">("tunai");
  const [received, setReceived] = useState("");

  const receivedNum = Number(received) || 0;
  const change = calcChange(receivedNum, total);

  function handlePay() {
    if (method === "tunai" && receivedNum < total) return;
    onPay(method, method === "tunai" ? receivedNum : undefined);
  }

  // uang pas + pecahan bulat
  const quickOpts = [total, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000]
    .filter((v, i, a) => v >= total && a.indexOf(v) === i)
    .slice(0, 4);

  return (
    <Modal open={open} onClose={onClose} title="Pembayaran">
      <div className="methods">
        {(["tunai", "qris", "kartu"] as const).map((m, i) => (
          <Button
            key={m}
            variant="small"
            radius={i === 1 ? "r2" : i === 2 ? "r3" : "r1"}
            active={m === method}
            onClick={() => setMethod(m)}
          >
            {METHOD_LABEL[m]}
          </Button>
        ))}
      </div>

      <div className="due">
        <span>Total tagihan</span>
        <b>{formatRp(total)}</b>
      </div>

      {method === "tunai" && (
        <>
          <div className="recv">
            <span>Uang diterima</span>
            <b>{formatRp(receivedNum)}</b>
          </div>
          <div className="quick">
            {quickOpts.map((v, i) => (
              <Button key={i} variant="small" radius="r2" onClick={() => setReceived(String(v))}>
                {i === 0 ? "Uang pas" : formatRp(v)}
              </Button>
            ))}
          </div>
          <Field
            label="Uang diterima (ketik manual)"
            type="number"
            inputMode="numeric"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder="0"
          />
          <div className="change">
            <span>{receivedNum && change >= 0 ? "Kembalian" : "Kurang"}</span>
            <b>{formatRp(receivedNum ? Math.abs(change) : total)}</b>
          </div>
          <div className="actions">
            <Button onClick={onClose}>Batal</Button>
            <Button
              variant="fill"
              onClick={handlePay}
              disabled={method === "tunai" && receivedNum < total}
            >
              Selesai
            </Button>
          </div>
        </>
      )}

      {method === "qris" && (
        <>
          <div className="center">
            <div className="qrbox box r3" style={{ width: 210, margin: "6px auto 10px" }}>
              {generateQR(`QRIS-DEMO-${total}`)}
            </div>
            <p className="hint">Minta pelanggan memindai kode ini dengan aplikasi pembayaran.</p>
          </div>
          <div className="actions">
            <Button onClick={onClose}>Batal</Button>
            <Button variant="fill" onClick={() => onPay("qris")}>Sudah dibayar</Button>
          </div>
        </>
      )}

      {method === "kartu" && (
        <>
          <div className="center">
            <p className="hint" style={{ marginTop: 8 }}>
              Tempel atau gesek kartu pada mesin EDC, lalu tekan tombol di bawah setelah pembayaran disetujui.
            </p>
          </div>
          <div className="actions">
            <Button onClick={onClose}>Batal</Button>
            <Button variant="fill" onClick={() => onPay("kartu")}>Pembayaran disetujui</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
