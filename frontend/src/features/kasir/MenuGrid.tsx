// features/kasir/MenuGrid.tsx
import { PhotoBox } from "../../components/ui/PhotoBox";
import { formatRp } from "../../lib/money";
import type { Product } from "../../data/seed";

type Props = {
  products: Product[];
  categories: { id: number; name: string }[];
  cartQty: Map<number, number>;
  onAdd: (product: Product) => void;
  onToggleStock: (product: Product) => void;
  stockMode: boolean;
  search: string;
};

export function MenuGrid({ products, categories, cartQty, onAdd, onToggleStock, stockMode, search }: Props) {
  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (filtered.length === 0) {
    return <div className="empty-menu">Menu tidak ditemukan. Coba kata kunci lain.</div>;
  }

  return (
    <>
      {filtered.map((product) => {
        const qty = cartQty.get(product.id) || 0;
        const category = categories.find((c) => c.id === product.categoryId);
        const disabled = product.soldOut && !stockMode;
        return (
          <button
            key={product.id}
            type="button"
            className="card box"
            disabled={disabled}
            onClick={() => (stockMode ? onToggleStock(product) : onAdd(product))}
          >
            {stockMode ? (
              <span className="qty edit-badge">{product.soldOut ? "Tandai ada" : "Tandai habis"}</span>
            ) : qty > 0 ? (
              <span className="qty pop">{qty}</span>
            ) : null}

            <PhotoBox src={product.image} alt={product.name} category={category?.name} />

            <span className="nm">{product.name}</span>
            <span className="pr">{product.soldOut ? "Habis" : formatRp(product.price)}</span>
          </button>
        );
      })}
    </>
  );
}
