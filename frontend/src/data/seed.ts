// data/seed.ts — tipe data & seed awal
export type Category = { id: number; name: string; order: number };
export type Product = { id: number; name: string; price: number; categoryId: number; soldOut?: boolean; image?: string };
export type Table = { id: number; number: number; token: string };
export type OrderLine = { productId: number; name: string; price: number; qty: number; note?: string };
export type OrderStatus = "baru" | "diterima" | "diproses" | "siap" | "selesai" | "ditolak";
export type Order = {
  id: number;
  number: number;
  source: "kasir" | "qr";
  type: "dine" | "take";
  tableNo?: number;
  customerName?: string;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  rejectReason?: string;
  payment: {
    status: "belum" | "lunas";
    method?: "tunai" | "qris" | "kartu";
    received?: number;
    paidAt?: string;
    qrisPending?: boolean;
  };
  createdAt: string;
};
export type Settings = {
  storeName: string;
  taxPct: number;
  discountPresets: number[];
  pinKasir: string;
  pinAdmin: string;
};

export type AppState = {
  categories: Category[];
  products: Product[];
  tables: Table[];
  orders: Order[];
  settings: Settings;
  nextOrderId: number;
};

// seed kategori
const categories: Category[] = [
  { id: 1, name: "Kopi", order: 0 },
  { id: 2, name: "Non-kopi", order: 1 },
  { id: 3, name: "Makanan", order: 2 },
  { id: 4, name: "Camilan", order: 3 },
];

// seed menu
const products: Product[] = [
  { id: 1, name: "Kopi susu gula aren", price: 22000, categoryId: 1 },
  { id: 2, name: "Americano", price: 18000, categoryId: 1 },
  { id: 3, name: "Latte", price: 25000, categoryId: 1 },
  { id: 4, name: "Kopi tubruk", price: 12000, categoryId: 1 },
  { id: 5, name: "Es teh manis", price: 8000, categoryId: 2 },
  { id: 6, name: "Matcha latte", price: 27000, categoryId: 2, soldOut: true },
  { id: 7, name: "Coklat dingin", price: 22000, categoryId: 2 },
  { id: 8, name: "Jeruk peras", price: 15000, categoryId: 2 },
  { id: 9, name: "Nasi goreng kampung", price: 28000, categoryId: 3 },
  { id: 10, name: "Mie goreng telur", price: 24000, categoryId: 3 },
  { id: 11, name: "Soto ayam", price: 26000, categoryId: 3 },
  { id: 12, name: "Roti bakar coklat keju", price: 18000, categoryId: 3 },
  { id: 13, name: "Pisang goreng", price: 12000, categoryId: 4 },
  { id: 14, name: "Kentang goreng", price: 16000, categoryId: 4 },
  { id: 15, name: "Tahu crispy", price: 14000, categoryId: 4 },
  { id: 16, name: "Cireng rujak", price: 13000, categoryId: 4 },
];

// seed meja 12 dengan token acak
function randomToken(): string {
  return Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
}
const tables: Table[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  token: randomToken(),
}));

const settings: Settings = {
  storeName: "Warung Kapur",
  taxPct: 11,
  discountPresets: [0, 5, 10],
  pinKasir: "1234",
  pinAdmin: "9999",
};

// seed riwayat 7 hari deterministik
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateHistory(): { orders: Order[]; nextOrderId: number } {
  const rand = seededRandom(42);
  const orders: Order[] = [];
  let orderId = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 6; d >= 1; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const count = 15 + Math.floor(rand() * 11); // 15-25
    for (let i = 0; i < count; i++) {
      const hour = 8 + Math.floor(rand() * 13);
      const minute = Math.floor(rand() * 60);
      const createdAt = new Date(day);
      createdAt.setHours(hour, minute, 0, 0);
      const source: "kasir" | "qr" = rand() > 0.4 ? "kasir" : "qr";
      const numLines = 1 + Math.floor(rand() * 3);
      const lines: OrderLine[] = [];
      for (let l = 0; l < numLines; l++) {
        const p = products[Math.floor(rand() * products.length)];
        if (lines.some((x) => x.productId === p.id)) continue;
        lines.push({ productId: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(rand() * 2) });
      }
      if (lines.length === 0) {
        const p = products[0];
        lines.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
      }
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const tax = Math.round((subtotal * 11) / 100);
      orders.push({
        id: orderId,
        number: orderId,
        source,
        type: rand() > 0.5 ? "dine" : "take",
        tableNo: source === "qr" ? 1 + Math.floor(rand() * 12) : undefined,
        lines,
        subtotal,
        discount: 0,
        tax,
        total: subtotal + tax,
        status: "selesai",
        payment: { status: "lunas", method: rand() > 0.3 ? "tunai" : "qris", paidAt: createdAt.toISOString() },
        createdAt: createdAt.toISOString(),
      });
      orderId++;
    }
  }
  return { orders, nextOrderId: orderId };
}

const { orders: historyOrders, nextOrderId } = generateHistory();

export function getSeedState(): AppState {
  return {
    categories,
    products,
    tables,
    orders: historyOrders,
    settings,
    nextOrderId,
  };
}
