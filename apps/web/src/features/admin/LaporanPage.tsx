// features/admin/LaporanPage.tsx — laporan + tabel transaksi + CSV
import { useState, useMemo } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../state/store-context";
import { formatRp } from "../../lib/money";
import { todayISO, formatDateTime } from "../../lib/time";
import { downloadCSV } from "../../lib/csv";
import { useCurrentDate } from "../../hooks/useCurrentDate";

type Period = "harian" | "mingguan" | "bulanan";

function startOf(period: Period, currentDate: Date): Date {
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  if (period === "harian") return now;
  if (period === "mingguan") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "harian", label: "Hari ini" },
  { id: "mingguan", label: "7 hari" },
  { id: "bulanan", label: "Bulan ini" },
];

export function LaporanPage() {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>("harian");
  const now = useCurrentDate();

  const periodStart = startOf(period, now);
  const todayStr = todayISO();

  const filtered = useMemo(() => {
    return state.orders
      .filter((o) => {
        if (o.status === "ditolak") return false;
        if (o.payment.status !== "lunas") return false;
        const d = new Date(o.createdAt);
        d.setHours(0, 0, 0, 0);
        return d >= periodStart && d <= now;
      })
      .sort((a, b) => b.number - a.number);
  }, [state.orders, periodStart, now]);

  const totalSales = filtered.reduce((s, o) => s + o.total, 0);
  const txCount = filtered.length;
  const avgTicket = txCount > 0 ? Math.round(totalSales / txCount) : 0;

  function exportCSV() {
    const rows: (string | number)[][] = [
      ["Nomor", "Waktu", "Sumber", "Meja", "Item", "Subtotal", "Diskon", "PPN", "Total", "Metode"],
      ...filtered.map((o) => [
        o.number,
        formatDateTime(o.createdAt),
        o.source,
        o.tableNo || "",
        o.lines.map((l) => `${l.name} x${l.qty}`).join("; "),
        o.subtotal,
        o.discount,
        o.tax,
        o.total,
        o.payment.method || "",
      ]),
    ];
    downloadCSV(`laporan-${period}-${todayStr}.csv`, rows);
  }

  return (
    <Shell role="admin" title="Laporan" sidebarContent={<AdminSidebar />}>
      <div className="inner">
        <div className="chips">
          {PERIODS.map((p, i) => (
            <Button
              key={p.id}
              variant="small"
              radius={i % 2 ? "r2" : "r3"}
              active={p.id === period}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <span className="sp" />
          <Button variant="small" onClick={exportCSV}>Salin CSV</Button>
        </div>

        <div className="sumrow">
          <span>
            Penjualan<b>{formatRp(totalSales)}</b>
          </span>
          <span>
            Transaksi<b>{txCount}</b>
          </span>
          <span>
            Rata-rata<b>{formatRp(avgTicket)}</b>
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <span className="ic" style={{ fontSize: 48 }} aria-hidden="true">📊</span>
            Belum ada transaksi di rentang ini.
          </div>
        ) : (
          <div className="tw">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Waktu</th>
                  <th>Sumber</th>
                  <th>Meja</th>
                  <th>Metode</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((o) => (
                  <tr key={o.id}>
                    <td>#{String(o.number).padStart(3, "0")}</td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td>{o.source === "qr" ? "QR" : "Kasir"}</td>
                    <td>{o.tableNo || "-"}</td>
                    <td>{o.payment.method || "-"}</td>
                    <td className="r">{formatRp(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="hint" style={{ marginTop: 10 }}>
                Menampilkan 50 dari {filtered.length} transaksi. Unduh CSV untuk data lengkap.
              </p>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
