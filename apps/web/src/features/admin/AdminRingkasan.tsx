// features/admin/AdminRingkasan.tsx — ringkasan admin
import { useMemo } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { useStore } from "../../state/store-context";
import { formatRp, formatShortRp } from "../../lib/money";
import { useCurrentDate } from "../../hooks/useCurrentDate";

export function AdminRingkasan() {
  const { state } = useStore();
  const now = useCurrentDate();
  const today = now.toISOString().slice(0, 10);

  const todayOrders = state.orders.filter((o) => o.createdAt.slice(0, 10) === today && o.payment.status === "lunas");
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const avgTicket = todayOrders.length > 0 ? Math.round(todaySales / todayOrders.length) : 0;
  const qrToday = state.orders.filter((o) => o.source === "qr" && o.createdAt.slice(0, 10) === today).length;

  const last7 = useMemo(() => {
    const days: { date: string; label: string; sales: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("id-ID", { weekday: "short" });
      const sales = state.orders
        .filter((o) => o.createdAt.slice(0, 10) === date && o.payment.status === "lunas")
        .reduce((s, o) => s + o.total, 0);
      days.push({ date, label, sales, isToday: i === 0 });
    }
    return days;
  }, [state.orders, now]);

  const maxSales = Math.max(1, ...last7.map((d) => d.sales));

  const top5 = useMemo(() => {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const fromStr = from.toISOString().slice(0, 10);
    const map = new Map<number, { name: string; qty: number }>();
    for (const o of state.orders) {
      if (o.createdAt.slice(0, 10) < fromStr) continue;
      if (o.payment.status !== "lunas") continue;
      for (const l of o.lines) {
        const cur = map.get(l.productId) || { name: l.name, qty: 0 };
        cur.qty += l.qty;
        map.set(l.productId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [state.orders, now]);

  // chart geometry (mirip referensi: W=560 H=232 bl=192 mh=140)
  const W = 560;
  const H = 232;
  const bl = 192;
  const mh = 140;
  const step = W / last7.length;
  const bw = Math.min(48, step - 22);

  return (
    <Shell role="admin" title="Ringkasan" sidebarContent={<AdminSidebar />}>
      <div className="inner">
        <div className="stats4">
          <div className="stat box">
            <span>Penjualan hari ini</span>
            <b>{formatRp(todaySales)}</b>
          </div>
          <div className="stat box r2">
            <span>Jumlah transaksi</span>
            <b>{todayOrders.length}</b>
          </div>
          <div className="stat box r3">
            <span>Rata-rata per transaksi</span>
            <b>{formatRp(avgTicket)}</b>
          </div>
          <div className="stat box">
            <span>Pesanan QR hari ini</span>
            <b>{qrToday}</b>
          </div>
        </div>

        <div className="twocol">
          <section className="panel box r2">
            <h2 className="sectitle">Penjualan 7 hari terakhir</h2>
            <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik penjualan 7 hari terakhir">
              {last7.map((d, i) => {
                const bh = Math.round((d.sales / maxSales) * mh);
                const x = Math.round(i * step + (step - bw) / 2);
                const y = bl - bh;
                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={bw}
                      height={Math.max(bh, 2)}
                      fill={d.isToday ? "currentColor" : "url(#hatch)"}
                      stroke="currentColor"
                      strokeWidth="2.5"
                      filter="url(#rough)"
                    />
                    <text x={x + bw / 2} y={y - 8} textAnchor="middle">
                      {formatShortRp(d.sales)}
                    </text>
                    <text className="dim" x={x + bw / 2} y={bl + 26} textAnchor="middle">
                      {d.isToday ? "Hari ini" : d.label}
                    </text>
                  </g>
                );
              })}
              <path
                d={`M4 ${bl}H${W - 4}`}
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                fill="none"
              />
            </svg>
          </section>

          <section className="panel box r3">
            <h2 className="sectitle">Menu terlaris, 7 hari</h2>
            <ol className="rank">
              {top5.map((p, i) => (
                <li key={i}>
                  <span>{i + 1}</span>
                  <span>{p.name}</span>
                  <span className="dim">{p.qty} porsi</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Shell>
  );
}
