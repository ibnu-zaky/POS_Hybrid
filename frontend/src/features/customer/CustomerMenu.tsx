// features/customer/CustomerMenu.tsx — halaman menu pelanggan via QR meja
import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../state/store-context";
import { PhotoBox } from "../../components/ui/PhotoBox";
import { Stepper } from "../../components/ui/Stepper";
import { Button } from "../../components/ui/Button";
import { formatRp } from "../../lib/money";
import { escapeHtml } from "../../lib/csv";
import { CartSheet } from "./CartSheet";
import type { Product } from "../../data/seed";

type Props = { meja: string };

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

export function CustomerMenu({ meja }: Props) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";

  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [sheetOpen, setSheetOpen] = useState(false);

  const table = state.tables.find((t) => String(t.number) === meja && t.token === token);

  const sortedCategories = [...state.categories].sort((a, b) => a.order - b.order);

  const filteredProducts = useMemo(() => {
    let list = state.products;
    if (activeCategoryId !== null) list = list.filter((p) => p.categoryId === activeCategoryId);
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [state.products, activeCategoryId, search]);

  const cartLines = useMemo(() => {
    return [...cart.entries()]
      .map(([productId, qty]) => {
        const product = state.products.find((p) => p.id === productId);
        if (!product) return null;
        return { productId, name: product.name, price: product.price, qty };
      })
      .filter(Boolean) as { productId: number; name: string; price: number; qty: number }[];
  }, [cart, state.products]);

  const subtotal = cartLines.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = Math.round((subtotal * state.settings.taxPct) / 100);
  const total = subtotal + tax;
  const itemCount = cartLines.reduce((s, l) => s + l.qty, 0);

  if (!table) {
    return (
      <div className="frame cust">
        <div className="cust">
          <div className="cerr">
            <h2>Kode meja tidak dikenali</h2>
            <p className="hint">Minta bantuan staf.</p>
          </div>
        </div>
      </div>
    );
  }

  function addToCart(product: Product) {
    if (product.soldOut) return;
    setCart((prev) => {
      const next = new Map(prev);
      next.set(product.id, (next.get(product.id) || 0) + 1);
      return next;
    });
  }

  function changeQty(productId: number, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(productId);
      else next.set(productId, qty);
      return next;
    });
  }

  const activeOrderCount = state.orders.filter(
    (o) => o.tableNo === table.number && o.status !== "selesai" && o.status !== "ditolak"
  ).length;

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

        <div className="cwrap">
          <label className="search box r2" style={{ maxWidth: "none" }}>
            <span className="ic" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Cari menu"
              autoComplete="off"
              aria-label="Cari menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="cchips">
            <Button variant="small" active={activeCategoryId === null} onClick={() => setActiveCategoryId(null)}>
              Semua
            </Button>
            {sortedCategories.map((cat, i) => (
              <Button
                key={cat.id}
                variant="small"
                radius={i % 2 ? "r2" : "r3"}
                active={activeCategoryId === cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
            <Button
              variant="small"
              radius="r3"
              onClick={() => navigate(`/m/${meja}/status?t=${token}`)}
            >
              Status pesanan{activeOrderCount ? ` (${activeOrderCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="clist" id="mlist">
          {filteredProducts.length === 0 ? (
            <div className="empty-menu">Menu tidak ditemukan. Coba kata kunci lain.</div>
          ) : (
            filteredProducts.map((product) => {
              const qty = cart.get(product.id) || 0;
              const category = state.categories.find((c) => c.id === product.categoryId);
              return (
                <div key={product.id} className={`mrow${product.soldOut ? " out" : ""}`}>
                  <PhotoBox src={product.image} alt={product.name} category={category?.name} />
                  <div>
                    <div className="mn">{escapeHtml(product.name)}</div>
                    <div className="mp">{product.soldOut ? "Habis" : formatRp(product.price)}</div>
                  </div>
                  <div>
                    {product.soldOut ? (
                      <span className="dim">Habis</span>
                    ) : qty > 0 ? (
                      <Stepper value={qty} onChange={(v) => changeQty(product.id, v)} min={0} name={product.name} />
                    ) : (
                      <Button variant="small" onClick={() => addToCart(product)}>Tambah</Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="cbar">
          <div className="info">
            <b>{formatRp(total)}</b>
            <span>{itemCount ? `${itemCount} item, sudah termasuk PPN` : "Belum ada pesanan"}</span>
          </div>
          <Button
            variant="fill"
            disabled={itemCount === 0}
            onClick={() => setSheetOpen(true)}
          >
            Lihat pesanan
          </Button>
        </footer>
      </div>

      <CartSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        lines={cartLines}
        onQtyChange={changeQty}
        onNoteChange={() => {}}
        subtotal={subtotal}
        tax={tax}
        total={total}
        taxPct={state.settings.taxPct}
        onClear={() => setCart(new Map())}
        tableNumber={table.number}
        onOrdered={(orderId) => {
          setCart(new Map());
          setSheetOpen(false);
          navigate(`/m/${meja}/status?order=${orderId}&t=${token}`);
        }}
      />
    </div>
  );
}
