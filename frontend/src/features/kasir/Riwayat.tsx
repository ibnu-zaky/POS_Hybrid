// features/kasir/Riwayat.tsx
import { Shell } from "../../components/ui/Shell";
import { KasirSidebar } from "./KasirSidebar";
import { Receipt } from "./Receipt";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../state/store-context";
import { useState } from "react";
import { formatRp } from "../../lib/money";
import { formatTime } from "../../lib/time";
import { useCurrentDate } from "../../hooks/useCurrentDate";
import type { Order, Product } from "../../data/seed";

type Props = {
  stockMode: boolean;
  onToggleStockMode: () => void;
  collapsed: boolean;
  incomingBadge: number;
};

export function Riwayat({ stockMode, onToggleStockMode, collapsed, incomingBadge }: Props) {
  const { state } = useStore();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const today = useCurrentDate().toDateString();
  const todayOrders = state.orders
    .filter((o) => new Date(o.createdAt).toDateString() === today && o.status === "selesai")
    .sort((a, b) => b.number - a.number);

  const totalSales = todayOrders.reduce((s, o) => s + o.total, 0);

  return (
    <Shell
      role="kasir"
      title="Riwayat hari ini"
      collapsed={collapsed}
      sidebarContent={
        <KasirSidebar
          activeCategoryId={activeCategoryId}
          onCategorySelect={setActiveCategoryId}
          stockMode={stockMode}
          onToggleStockMode={onToggleStockMode}
          collapsed={collapsed}
          incomingBadge={incomingBadge}
          onAddToOrder={(_p: Product) => {}}
        />
      }
    >
      <div className="inner">
        <div className="sumrow">
          <span>
            Transaksi<b>{todayOrders.length}</b>
          </span>
          <span>
            Penjualan<b>{formatRp(totalSales)}</b>
          </span>
        </div>

        {todayOrders.length === 0 ? (
          <div className="empty">
            <span className="ic" style={{ fontSize: 48 }} aria-hidden="true">🕐</span>
            Belum ada transaksi selesai hari ini.
          </div>
        ) : (
          <div className="tw">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Jam</th>
                  <th>Sumber</th>
                  <th>Meja</th>
                  <th>Metode</th>
                  <th className="r">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {todayOrders.map((order) => (
                  <tr key={order.id}>
                    <td>#{String(order.number).padStart(3, "0")}</td>
                    <td>{formatTime(order.createdAt)}</td>
                    <td>{order.source === "qr" ? "QR" : "Kasir"}</td>
                    <td>{order.tableNo ? `Meja ${order.tableNo}` : "Bawa pulang"}</td>
                    <td>{order.payment.method || "-"}</td>
                    <td className="r">{formatRp(order.total)}</td>
                    <td className="r">
                      <div className="acts">
                        <Button variant="small" radius="r3" onClick={() => setReceiptOrder(order)}>
                          Lihat struk
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptOrder && (
        <Receipt order={receiptOrder} storeName={state.settings.storeName} onClose={() => setReceiptOrder(null)} />
      )}
    </Shell>
  );
}
