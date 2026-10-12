// features/customer/OrderStatus.tsx — halaman status pesanan pelanggan
import { useSearchParams, useNavigate } from "react-router-dom";
import { useStore } from "../../state/store-context";
import { Button } from "../../components/ui/Button";
import { formatRp } from "../../lib/money";
import { formatTime } from "../../lib/time";

type Props = { meja: string };

const STAGES = ["diterima", "diproses", "siap", "selesai"] as const;
const STAGE_LABELS: Record<string, string> = {
  diterima: "Diterima",
  diproses: "Dibuat",
  siap: "Siap diantar",
  selesai: "Selesai",
};

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 26h31v12a15 15 0 0 1-15 15h-1a15 15 0 0 1-15-15z" />
        <path d="M44 30h3a7 7 0 0 1 0 14h-5" />
        <path d="M21 18q-4-5 0-9M29 18q-4-5 0-9M37 18q-4-5 0-9" />
        <path d="M9 58h38" />
      </g>
    </svg>
  );
}

export function OrderStatus({ meja }: Props) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = Number(searchParams.get("order"));

  const order = state.orders.find((o) => o.id === orderId);

  const token = searchParams.get("t");
  const table = state.tables.find((t) => String(t.number) === meja);

  if (!order || !table || (token && table.token !== token)) {
    return (
      <div className="frame cust">
        <div className="cust">
          <div className="cerr">
            <h2>Pesanan tidak ditemukan</h2>
            <p className="hint">Minta bantuan staf.</p>
            <Button onClick={() => navigate(`/m/${meja}?t=${table?.token || ""}`)} style={{ marginTop: 16 }}>
              Kembali ke menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isRejected = order.status === "ditolak";

  const stepIdxMap: Record<string, number> = { baru: -1, diterima: 0, diproses: 1, siap: 2, selesai: 4, ditolak: -2 };
  const idx = stepIdxMap[order.status] ?? -1;

  return (
    <div className="frame cust">
      <div className="cust">
        <header className="chdr">
          <div className="brand">
            <Logo />
            <div>
              <h1>{state.settings.storeName}</h1>
            </div>
          </div>
          <span className="sp" />
          <span className="stamp box r2">Meja {meja}</span>
        </header>

        <div className="clist" id="mlist">
          <section className="ostat box r2">
            <header>
              <b>Pesanan #{String(order.number).padStart(3, "0")}</b>
              <span className="dim">{formatTime(order.createdAt)}</span>
            </header>

            {isRejected ? (
              <p className="why">Pesanan ditolak. Alasan: {order.rejectReason || "-"}</p>
            ) : (
              <>
                {order.status === "baru" ? (
                  <p className="wait">Menunggu kasir menerima pesanan.</p>
                ) : (
                  <ul className="track" aria-label="Tahap pesanan">
                    {STAGES.map((stage, i) => {
                      const cls = i < idx ? "done" : i === idx ? "cur" : "";
                      return (
                        <li key={stage} className={cls}>
                          <span className="dot">
                            {cls === "done" && (
                              <svg viewBox="0 0 64 64" aria-hidden="true">
                                <path
                                  d="M12 34l14 14 26-30"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="t">{STAGE_LABELS[stage]}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {order.payment.status !== "lunas" && (
                  <p className="hint">
                    {order.payment.method === "qris"
                      ? "Menunggu verifikasi kasir."
                      : "Silakan bayar di kasir."}
                  </p>
                )}
                {order.payment.status === "lunas" && <p className="hint">Pembayaran lunas.</p>}
              </>
            )}

            <ul className="oitems">
              {order.lines.map((line) => (
                <li key={line.productId}>
                  <span>
                    {line.qty} × {line.name}
                    {line.note && <span className="note">Catatan: {line.note}</span>}
                  </span>
                  <span>{formatRp(line.price * line.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="row">
              <span>Total</span>
              <span>{formatRp(order.total)}</span>
            </div>
          </section>
        </div>

        <footer className="cbar">
          <span className="dim">Meja {meja}</span>
          <Button
            variant="fill"
            onClick={() => navigate(`/m/${meja}?t=${table.token}`)}
          >
            Tambah pesanan
          </Button>
        </footer>
      </div>
    </div>
  );
}
