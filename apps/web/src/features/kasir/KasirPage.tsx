// features/kasir/KasirPage.tsx — Halaman Kasir utama
import { useState, useMemo, useEffect } from "react";
import { Shell } from "../../components/ui/Shell";
import { KasirSidebar } from "./KasirSidebar";
import { MenuGrid } from "./MenuGrid";
import { OrderPanel } from "./OrderPanel";
import { PayModal } from "./PayModal";
import { Receipt } from "./Receipt";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { calcOrder, formatRp } from "../../lib/money";
import { loadJSON, saveJSON } from "../../lib/storage";
import type { Order, OrderLine, Product } from "../../data/seed";
import { useCurrentDate } from "../../hooks/useCurrentDate";

const KASIR_STATE_KEY = "wk-kasir-draft";

type KasirDraft = {
  lines: OrderLine[];
  discountPct: number;
};

function loadDraft(): KasirDraft {
  return loadJSON<KasirDraft>(KASIR_STATE_KEY, { lines: [], discountPct: 0 });
}

export function KasirPage() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [stockMode, setStockMode] = useState(false);
  const [collapsed, setCollapsed] = useState(() => loadJSON<boolean>("wk-sidebar-collapsed", false));
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<KasirDraft>(loadDraft);
  const [payOpen, setPayOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [panelOpenMobile, setPanelOpenMobile] = useState(false);

  useEffect(() => {
    saveJSON(KASIR_STATE_KEY, draft);
  }, [draft]);

  const incomingBadge = state.orders.filter((o) => o.status === "baru" && o.source === "qr").length;

  const filteredProducts = useMemo(() => {
    let list = state.products;
    if (activeCategoryId !== null) list = list.filter((p) => p.categoryId === activeCategoryId);
    return list;
  }, [state.products, activeCategoryId]);

  const cartQty = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of draft.lines) m.set(l.productId, l.qty);
    return m;
  }, [draft.lines]);

  const totals = useMemo(() => {
    return calcOrder(draft.lines, draft.discountPct, state.settings.taxPct);
  }, [draft.lines, draft.discountPct, state.settings.taxPct]);

  const itemCount = draft.lines.reduce((s, l) => s + l.qty, 0);

  const today = useCurrentDate().toDateString();
  const todayPaid = state.orders.filter(
    (o) => o.status === "selesai" && new Date(o.createdAt).toDateString() === today
  );
  const todaySales = todayPaid.reduce((s, o) => s + o.total, 0);

  function addToOrder(product: Product) {
    if (product.soldOut) return;
    setDraft((d) => {
      const existing = d.lines.find((l) => l.productId === product.id);
      if (existing) {
        return {
          ...d,
          lines: d.lines.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l)),
        };
      }
      return { ...d, lines: [...d.lines, { productId: product.id, name: product.name, price: product.price, qty: 1 }] };
    });
  }

  function changeQty(productId: number, qty: number) {
    if (qty <= 0) {
      setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.productId !== productId) }));
    } else {
      setDraft((d) => ({
        ...d,
        lines: d.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)),
      }));
    }
  }

  function toggleStock(product: Product) {
    dispatch({ type: "UPDATE_PRODUCT", payload: { id: product.id, patch: { soldOut: !product.soldOut } } });
  }

  function handlePay(method: "tunai" | "qris" | "kartu", received?: number) {
    const order: Order = {
      id: state.nextOrderId,
      number: state.nextOrderId,
      source: "kasir",
      type: "dine",
      lines: draft.lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      status: "selesai",
      payment: {
        status: "lunas",
        method,
        received,
        paidAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_ORDER", payload: order });
    setPayOpen(false);
    setDraft({ lines: [], discountPct: 0 });
    setReceiptOrder(order);
    toast("Pesanan tersimpan");
  }

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    saveJSON("wk-sidebar-collapsed", next);
  }

  return (
    <Shell
      role="kasir"
      title="Kasir"
      collapsed={collapsed}
      onToggleCollapse={toggleCollapse}
      headerExtra={
        <span className="hstat box r3 hidemob">
          <span>Hari ini, {todayPaid.length} transaksi</span>
          <b>{formatRp(todaySales)}</b>
        </span>
      }
      sidebarContent={
        <KasirSidebar
          activeCategoryId={activeCategoryId}
          onCategorySelect={setActiveCategoryId}
          stockMode={stockMode}
          onToggleStockMode={() => setStockMode(!stockMode)}
          collapsed={collapsed}
          incomingBadge={incomingBadge}
          onAddToOrder={addToOrder}
        />
      }
    >
      <div className="kasir">
        <section className="menu">
          <div className="toolbar">
            <label className="search box r2">
              <span className="ic" aria-hidden="true">🔍</span>
              <input
                id="q"
                type="search"
                placeholder="Cari menu"
                autoComplete="off"
                aria-label="Cari menu"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {stockMode && (
            <p className="edit-hint box r2">Mode atur stok: ketuk menu untuk menandai habis atau tersedia.</p>
          )}
          <div className="grid" id="grid">
            <MenuGrid
              products={filteredProducts}
              categories={state.categories}
              cartQty={cartQty}
              onAdd={addToOrder}
              onToggleStock={toggleStock}
              stockMode={stockMode}
              search={search}
            />
          </div>
        </section>

        {/* desktop: panel pesanan */}
        <aside className="ticket box no-mobile-drawer" aria-label="Pesanan saat ini">
          <OrderPanel
            lines={draft.lines}
            orderNumber={state.nextOrderId}
            discountPct={draft.discountPct}
            discountPresets={state.settings.discountPresets}
            onDiscountChange={(pct) => setDraft((d) => ({ ...d, discountPct: pct }))}
            onQtyChange={changeQty}
            onClear={() => setDraft({ lines: [], discountPct: 0 })}
            onPay={() => setPayOpen(true)}
            taxPct={state.settings.taxPct}
            subtotal={totals.subtotal}
            discount={totals.discount}
            tax={totals.tax}
            total={totals.total}
          />
        </aside>

        {/* mobile: bar total di bawah */}
        <div className="mbar mobile-total-bar">
          <div className="info">
            <b>{formatRp(totals.total)}</b>
            <span>{itemCount ? `${itemCount} item di pesanan` : "Belum ada pesanan"}</span>
          </div>
          <button type="button" className="btn fill box" onClick={() => setPanelOpenMobile(true)}>
            Lihat pesanan
          </button>
        </div>
      </div>

      {/* mobile drawer panel pesanan */}
      {panelOpenMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pesanan"
          className="overlay"
          onClick={() => setPanelOpenMobile(false)}
        >
          <div
            className="dialog box r2"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(420px, 100%)", maxHeight: "92%" }}
          >
            <OrderPanel
              lines={draft.lines}
              orderNumber={state.nextOrderId}
              discountPct={draft.discountPct}
              discountPresets={state.settings.discountPresets}
              onDiscountChange={(pct) => setDraft((d) => ({ ...d, discountPct: pct }))}
              onQtyChange={changeQty}
              onClear={() => setDraft({ lines: [], discountPct: 0 })}
              onPay={() => {
                setPanelOpenMobile(false);
                setPayOpen(true);
              }}
              taxPct={state.settings.taxPct}
              subtotal={totals.subtotal}
              discount={totals.discount}
              tax={totals.tax}
              total={totals.total}
            />
          </div>
        </div>
      )}

      <PayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={totals.total}
        onPay={handlePay}
      />

      {receiptOrder && (
        <Receipt order={receiptOrder} storeName={state.settings.storeName} onClose={() => setReceiptOrder(null)} />
      )}
    </Shell>
  );
}
