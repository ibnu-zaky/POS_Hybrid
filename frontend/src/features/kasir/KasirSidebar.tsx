// features/kasir/KasirSidebar.tsx
import { NavLink } from "react-router-dom";
import { useStore } from "../../state/store-context";
import { removeSession } from "../../lib/storage";
import { useNavigate } from "react-router-dom";
import { PhotoBox } from "../../components/ui/PhotoBox";
import { useCurrentDate } from "../../hooks/useCurrentDate";
import type { Product } from "../../data/seed";

type Props = {
  activeCategoryId: number | null;
  onCategorySelect: (id: number | null) => void;
  stockMode: boolean;
  onToggleStockMode: () => void;
  collapsed: boolean;
  incomingBadge: number;
  onAddToOrder: (product: Product) => void;
};

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="ic">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 26h31v12a15 15 0 0 1-15 15h-1a15 15 0 0 1-15-15z" />
        <path d="M44 30h3a7 7 0 0 1 0 14h-5" />
        <path d="M21 18q-4-5 0-9M29 18q-4-5 0-9M37 18q-4-5 0-9" />
        <path d="M9 58h38" />
      </g>
    </svg>
  );
}

export function KasirSidebar({
  activeCategoryId,
  onCategorySelect,
  stockMode,
  onToggleStockMode,
  incomingBadge,
  onAddToOrder,
}: Props) {
  const { state } = useStore();
  const navigate = useNavigate();

  const sortedCategories = [...state.categories].sort((a, b) => a.order - b.order);

  const today = useCurrentDate().toDateString();
  const todayOrders = state.orders.filter((o) => new Date(o.createdAt).toDateString() === today && o.status !== "ditolak");
  const salesByProduct = new Map<number, { name: string; qty: number; product: Product }>();
  for (const order of todayOrders) {
    for (const line of order.lines) {
      const prev = salesByProduct.get(line.productId);
      if (prev) {
        prev.qty += line.qty;
      } else {
        const product = state.products.find((p) => p.id === line.productId);
        if (product) {
          salesByProduct.set(line.productId, { name: line.name, qty: line.qty, product });
        }
      }
    }
  }
  const topProducts = [...salesByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  function handleLogout() {
    removeSession("wk-role");
    navigate("/login");
  }

  return (
    <>
      <div className="sbrand">
        <Logo />
        <b className="lbl">{state.settings.storeName}</b>
      </div>
      <nav className="snav">
        <NavLink to="/kasir" end className={({ isActive }) => `navi${isActive ? " on" : ""}`}>
          <span className="lbl">Kasir</span>
        </NavLink>
        <NavLink to="/kasir/pesanan-masuk" className={({ isActive }) => `navi${isActive ? " on" : ""}`}>
          <span className="lbl">Pesanan masuk</span>
          {incomingBadge > 0 && <span className="bdg pop">{incomingBadge}</span>}
        </NavLink>
        <NavLink to="/kasir/riwayat" className={({ isActive }) => `navi${isActive ? " on" : ""}`}>
          <span className="lbl">Riwayat hari ini</span>
        </NavLink>
      </nav>
      <div className="sscroll">
        <div className="stitle hidecol">Kategori</div>
        <button
          type="button"
          className={`navi${activeCategoryId === null ? " on" : ""}`}
          onClick={() => onCategorySelect(null)}
        >
          <span className="lbl">Semua</span>
          <span className="cnt">{state.products.length}</span>
        </button>
        {sortedCategories.map((cat) => {
          const count = state.products.filter((p) => p.categoryId === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              className={`navi${activeCategoryId === cat.id ? " on" : ""}`}
              onClick={() => onCategorySelect(cat.id)}
            >
              <span className="lbl">{cat.name}</span>
              <span className="cnt">{count}</span>
            </button>
          );
        })}

        {topProducts.length > 0 && (
          <>
            <div className="stitle hidecol">Menu terlaris hari ini</div>
            {topProducts.map(({ name, product }) => (
              <div key={product.id} className="ts hidecol">
                <PhotoBox src={product.image} alt={name} />
                <span className="tsn">{name}</span>
                <button
                  type="button"
                  className="rbtn"
                  aria-label={`Tambah ${name}`}
                  onClick={() => onAddToOrder(product)}
                >
                  +
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="sfoot">
        <div className="who">Kasir</div>
        <button
          type="button"
          className={`navi${stockMode ? " on" : ""}`}
          onClick={onToggleStockMode}
        >
          <span className="lbl">{stockMode ? "Selesai atur stok" : "Atur stok"}</span>
        </button>
        <button type="button" className="navi" onClick={handleLogout}>
          <span className="lbl">Keluar</span>
        </button>
      </div>
    </>
  );
}
