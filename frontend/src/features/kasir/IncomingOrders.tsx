// features/kasir/IncomingOrders.tsx — halaman pesanan masuk (kasir)
import { useState, useMemo, useEffect, useRef } from "react";
import { Shell } from "../../components/ui/Shell";
import { KasirSidebar } from "./KasirSidebar";
import { StatusChip, PaymentChip } from "../../components/ui/StatusChip";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { formatRp } from "../../lib/money";
import { minutesAgo } from "../../lib/time";
import { escapeHtml } from "../../lib/csv";
import type { Order, OrderStatus, Product } from "../../data/seed";

type Props = {
  stockMode: boolean;
  onToggleStockMode: () => void;
  collapsed: boolean;
};

const FILTERS: { id: "all" | "baru" | "diproses" | "siap" | "selesai"; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "baru", label: "Baru" },
  { id: "diproses", label: "Diproses" },
  { id: "siap", label: "Siap" },
  { id: "selesai", label: "Selesai" },
];
type Filter = (typeof FILTERS)[number]["id"];

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  baru: "diterima",
  diterima: "diproses",
  diproses: "siap",
  siap: "selesai",
  selesai: null,
  ditolak: null,
};

export function IncomingOrders({ stockMode, onToggleStockMode, collapsed }: Props) {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const seenNewIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    const newQr = state.orders.filter((o) => o.source === "qr" && o.status === "baru");
    for (const o of newQr) {
      if (!seenNewIds.current.has(o.id)) {
        seenNewIds.current.add(o.id);
        if (o.id !== state.nextOrderId) {
          toast(`Pesanan baru dari Meja ${o.tableNo}`);
        }
      }
    }
  }, [state.orders, state.nextOrderId, toast]);

  const qrOrders = useMemo(() => {
    return state.orders
      .filter((o) => o.source === "qr")
      .sort((a, b) => b.number - a.number);
  }, [state.orders]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "baru": return qrOrders.filter((o) => o.status === "baru");
      case "diproses": return qrOrders.filter((o) => o.status === "diterima" || o.status === "diproses");
      case "siap": return qrOrders.filter((o) => o.status === "siap");
      case "selesai": return qrOrders.filter((o) => o.status === "selesai" || o.status === "ditolak");
      default: return qrOrders;
    }
  }, [qrOrders, filter]);

  const newCount = qrOrders.filter((o) => o.status === "baru").length;

  function handleAdvance(order: Order) {
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    dispatch({ type: "UPDATE_ORDER", payload: { id: order.id, patch: { status: next } } });
    if (next === "diterima") toast(`Pesanan #${order.number} diterima`);
  }

  function handleReject() {
    if (!rejectTarget) return;
    dispatch({
      type: "UPDATE_ORDER",
      payload: {
        id: rejectTarget.id,
        patch: { status: "ditolak", rejectReason: rejectReason ? escapeHtml(rejectReason) : "Ditolak oleh kasir" },
      },
    });
    toast(`Pesanan #${rejectTarget.number} ditolak`);
    setRejectTarget(null);
    setRejectReason("");
  }

  function handleMarkPaid(order: Order) {
    dispatch({
      type: "UPDATE_ORDER",
      payload: {
        id: order.id,
        patch: {
          payment: { ...order.payment, status: "lunas", paidAt: new Date().toISOString(), qrisPending: false },
        },
      },
    });
    toast(`Pesanan #${order.number} lunas`);
    setPayTarget(null);
  }

  return (
    <Shell
      role="kasir"
      title="Pesanan masuk"
      collapsed={collapsed}
      sidebarContent={
        <KasirSidebar
          activeCategoryId={activeCategoryId}
          onCategorySelect={setActiveCategoryId}
          stockMode={stockMode}
          onToggleStockMode={onToggleStockMode}
          collapsed={collapsed}
          incomingBadge={newCount}
          onAddToOrder={(_p: Product) => {}}
        />
      }
    >
      <div className="inner">
        <div className="chips">
          {FILTERS.map((f, i) => (
            <Button
              key={f.id}
              variant="small"
              radius={i % 2 ? "r2" : "r3"}
              active={f.id === filter}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id === "baru" && newCount > 0 && <span className="bdg" style={{ marginLeft: 6 }}>{newCount}</span>}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <span className="ic" style={{ fontSize: 48 }} aria-hidden="true">🔔</span>
            Belum ada pesanan masuk.
            <br />
            Pesanan dari QR meja akan muncul di sini.
          </div>
        ) : (
          <div className="olist">
            {filtered.map((order, i) => (
              <article key={order.id} className={`ocard box ${i % 2 ? "r2" : "r3"}`}>
                <header>
                  <b>#{String(order.number).padStart(3, "0")}</b>
                  <span>
                    {order.tableNo ? `Meja ${order.tableNo}` : "Bawa pulang"}
                    {order.customerName ? `, ${order.customerName}` : ""}
                  </span>
                  <span className="dim">{minutesAgo(order.createdAt)}</span>
                </header>
                <div className="tags">
                  <StatusChip status={order.status} />
                  {order.status !== "ditolak" && (
                    <PaymentChip paid={order.payment.status === "lunas"} method={order.payment.method} />
                  )}
                </div>
                <ul>
                  {order.lines.slice(0, 3).map((l) => (
                    <li key={l.productId}>
                      {l.qty} × {l.name}
                      {l.note && <span className="note">Catatan: {l.note}</span>}
                    </li>
                  ))}
                  {order.lines.length > 3 && <li className="dim">dan {order.lines.length - 3} lainnya</li>}
                </ul>
                {order.status === "ditolak" && <p className="why">Alasan: {order.rejectReason || "-"}</p>}
                <div className="ofoot">
                  <span className="tot">{formatRp(order.total)}</span>
                  <div className="oact">
                    {order.status === "baru" && (
                      <>
                        <Button radius="r2" onClick={() => setRejectTarget(order)}>Tolak</Button>
                        <Button active onClick={() => handleAdvance(order)}>Terima</Button>
                      </>
                    )}
                    {order.status === "diterima" && (
                      <Button active onClick={() => handleAdvance(order)}>Mulai dibuat</Button>
                    )}
                    {order.status === "diproses" && (
                      <Button active onClick={() => handleAdvance(order)}>Tandai siap</Button>
                    )}
                    {order.status === "siap" && (
                      <Button
                        active
                        disabled={order.payment.status !== "lunas"}
                        title={order.payment.status !== "lunas" ? "Pesanan belum dibayar" : undefined}
                        onClick={() => handleAdvance(order)}
                      >
                        Selesaikan
                      </Button>
                    )}
                    {order.payment.status !== "lunas" && order.status !== "ditolak" && order.status !== "selesai" && (
                      order.payment.method === "qris" ? (
                        <Button radius="r3" onClick={() => handleMarkPaid(order)}>Tandai lunas</Button>
                      ) : (
                        <Button radius="r3" onClick={() => setPayTarget(order)}>Bayar</Button>
                      )
                    )}
                    {order.status === "selesai" && (
                      <Button radius="r3" onClick={() => setPayTarget(order)}>Lihat struk</Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Tolak pesanan">
        <label className="field">
          Alasan singkat
          <span className="box r3">
            <input
              type="text"
              placeholder="Contoh: menu habis"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </span>
        </label>
        <div className="actions">
          <Button onClick={() => setRejectTarget(null)}>Batal</Button>
          <Button variant="fill" onClick={handleReject}>Tolak</Button>
        </div>
      </Modal>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="Bayar pesanan">
        {payTarget && (
          <>
            <div className="due">
              <span>Total tagihan</span>
              <b>{formatRp(payTarget.total)}</b>
            </div>
            <div className="actions">
              <Button onClick={() => setPayTarget(null)}>Batal</Button>
              <Button variant="fill" onClick={() => handleMarkPaid(payTarget)}>Tandai lunas</Button>
            </div>
          </>
        )}
      </Modal>
    </Shell>
  );
}
