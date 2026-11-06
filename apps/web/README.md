# Warung Kapur — Prototype POS Hybrid

Prototype sistem kasir (POS) kafe/warung dengan tema papan tulis kapur (hitam putih). Tiga tampilan dalam satu aplikasi: Kasir, Admin, dan Pelanggan (via QR meja).

## Cara menjalankan

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`.

## Login & PIN awal

| Peran  | Rute               | PIN   |
|--------|--------------------|-------|
| Kasir  | `/kasir`           | `1234` |
| Admin  | `/admin`           | `9999` |

Sesi disimpan di `sessionStorage` (kunci `wk-role`). Kasir tidak bisa membuka `/admin`. Rute `/m/*` publik tanpa login.

## Rute

- `/login` — pilih peran lalu keypad PIN
- `/kasir`, `/kasir/pesanan-masuk`, `/kasir/riwayat`
- `/admin`, `/admin/menu`, `/admin/kategori`, `/admin/meja`, `/admin/laporan`, `/admin/pengaturan`
- `/m/:meja?t=TOKEN` — halaman menu pelanggan (scan QR)
- `/m/:meja/status?order=ID` — status pesanan pelanggan

## Struktur folder

```
src/
  main.tsx, App.tsx, routes.tsx
  styles/          tokens.css, chalk.css, layout.css, print.css
  lib/             money.ts, bus.ts, storage.ts, image.ts, qr.ts, csv.ts, time.ts
  data/            seed.ts
  state/           store.tsx
  components/ui/   Shell, Sidebar, Header, Button, Modal, Toast, Chip, StatusChip,
                   Field, Stepper, PhotoBox, EmptyState
  features/
    auth/          Login.tsx, RoleGuard.tsx
    kasir/         KasirPage, MenuGrid, OrderPanel, PayModal, Receipt,
                   IncomingOrders, Riwayat, KasirSidebar
    admin/         AdminRingkasan, AdminSidebar, MenuPage, KategoriPage,
                   MejaPage, LaporanPage, PengaturanPage
    customer/      CustomerMenu, CartSheet, OrderStatus
```

## Library

Hanya dua: `react-router-dom` (routing) dan `qrcode` (QR meja). Tanpa Tailwind, tanpa UI kit, tanpa library chart/animasi/state management. Data di `localStorage` (kunci `wk-state-v1`) + sinkron antar tab via `BroadcastChannel('wk')`.

## Batasan prototype

- Tanpa backend — semua data di localStorage peramban. Untuk produksi, bus lokal diganti API + WebSocket/SSE.
- Pembayaran QRIS hanya simulasi (tombol "Tandai lunas" manual oleh kasir).
- Foto menu disimpan sebagai data URL (JPEG 0.8, maks 640px) — memakan kuota localStorage.
- Tidak ada autentikasi server; PIN hanya untuk UX prototype.
