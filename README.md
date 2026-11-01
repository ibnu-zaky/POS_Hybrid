# POS Hybrid

POS Hybrid adalah aplikasi point-of-sale untuk usaha retail dan F&B. Repositori ini berisi backend REST API berbasis Node.js/Express dan frontend React untuk alur kasir, admin, serta pemesanan pelanggan melalui QR.

> **Status:** proyek dalam pengembangan. Frontend saat ini adalah prototipe interaktif berbasis data contoh di browser; frontend belum terhubung ke backend. Backend menyediakan API PostgreSQL multi-tenant untuk POS dan operasional merchant.

## Fitur

### Frontend

- Tampilan kasir untuk membuat pesanan, memproses pembayaran, dan melihat riwayat.
- Tampilan pesanan pelanggan melalui URL meja, misalnya `/m/1`, beserta status pesanan.
- Area admin untuk konfigurasi operasional.
- Data contoh disimpan di browser (`localStorage`) dan perubahan disinkronkan antar-tab pada browser yang sama.

### Backend API

- Autentikasi login, refresh token, logout, JWT, API key, dan role admin/manager/cashier/integration.
- Isolasi merchant menggunakan PostgreSQL Row-Level Security (RLS).
- Transaksi POS, idempotensi, struk, laporan, dan dashboard.
- Inventory, pergerakan stok, serta perlindungan dari overselling.
- Integrasi pembayaran melalui adapter Stripe, Xendit, QRIS, dan dummy; mode dummy adalah default.
- Operasional HR, analytics, e-commerce, click-and-collect, dan accounting.
- Validasi request, health check, dan webhook pembayaran.

Konektor e-commerce dan accounting saat ini menggunakan adapter placeholder/dummy; konfigurasi koneksi tidak dengan sendirinya mengaktifkan integrasi provider produksi.

## Teknologi

- **Frontend:** React 19, TypeScript, Vite, React Router.
- **Backend:** Node.js, Express 5, PostgreSQL, Zod, JWT, Argon2.
- **Database:** migrasi SQL di `migrations/`.

## Prasyarat

- Node.js 20 atau lebih baru.
- npm.
- PostgreSQL untuk menjalankan backend.

## Menjalankan frontend

```bash
cd frontend
npm install
npm run dev
```

Buka alamat lokal yang ditampilkan Vite (biasanya `http://localhost:5173`). Frontend menggunakan data contoh lokal dan tidak memerlukan backend untuk dicoba.

Perintah tambahan:

```bash
npm run build
npm run lint
npm run preview
```

## Menjalankan backend

1. Buat database PostgreSQL untuk aplikasi.
2. Sediakan runner migrasi otomatis via `npm run migrate`. Script menggunakan `ADMIN_DATABASE_URL` atau `DATABASE_URL`, membuat tabel `schema_migrations` jika tidak ada, dan menjalankan semua file `.sql` di direktori `migrations/`, hanya menjalankan file yang belum diterapkan. Runner idempotent dan aman untuk CI/prod.
3. Siapkan konfigurasi lokal:

   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

4. Isi `DATABASE_URL` agar menggunakan role aplikasi `pos_app`, lalu ganti `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, dan secret lain dengan nilai lokal yang kuat. Jika membuat merchant lewat script provisioning, atur `ADMIN_DATABASE_URL` ke koneksi database administrator; variabel ini wajib di production untuk script tersebut.
5. Dari direktori `backend`, jalankan migrasi:

   ```bash
   npm run migrate
   npm run seed-dev
   npm run dev
   ```

API berjalan pada `http://localhost:3000` secara default. Periksa koneksi API dan database dengan:

```bash
curl http://localhost:3000/health
```

Seed development menyediakan akun lokal `admin@dev.local` dengan password `devpassword123` dan merchant development tetap. **Gunakan hanya untuk development; jangan gunakan akun, secret, atau konfigurasi seed ini di production.** Endpoint `/auth/dev-login` hanya untuk pengembangan dan dinonaktifkan secara default.

### Pengujian backend

Tes backend mencakup unit dan integrasi. Siapkan database yang sudah menjalankan seluruh migrasi serta data development dengan `npm run seed-dev`, lalu dari direktori `backend` jalankan:

```bash
npm test
```

## Endpoint utama

Semua endpoint tersedia pada origin backend, misalnya `http://localhost:3000`.

| Area | Endpoint contoh | Keterangan |
|---|---|---|
| Health | `GET /health` | Memeriksa API dan koneksi database |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` | Autentikasi dan profil pengguna |
| POS | `POST /pos/transactions`, `GET /pos/transactions` | Membuat dan melihat transaksi |
| Payments | `POST /pos/transactions/:id/payments` | Membuat pembayaran transaksi |
| Inventory | `GET /admin/inventory`, `POST /admin/inventory` | Pengelolaan stok oleh admin |
| Analytics | `GET /admin/analytics/sales-by-product` | Analisis produk |
| Webhook | `POST /webhooks/payment/completion` | Callback penyelesaian pembayaran |

Sebagian besar endpoint memerlukan bearer token dan role yang sesuai. Login menggunakan `X-Tenant-ID` untuk menentukan merchant, selain kredensial login. Lihat implementasi route di `backend/src/routes/` untuk endpoint, role, dan validasi yang lebih lengkap.

## Struktur repositori

```text
backend/       REST API, layanan, adapter, dan tes
frontend/      UI kasir/admin/pelanggan berbasis React
migrations/    Migrasi skema PostgreSQL
plan/          Rencana produk dan teknis
```

## Catatan keamanan

- Jangan commit `.env`, kredensial database, token, atau secret provider. Gunakan `.env.example` hanya sebagai referensi konfigurasi.
- Jangan gunakan password seed development, placeholder migrasi, atau secret contoh di lingkungan produksi.
- Mode pembayaran live dan integrasi eksternal membutuhkan kredensial provider, konfigurasi webhook, serta pengujian deployment yang sesuai.
- Frontend belum menggunakan autentikasi/API backend dan penyimpanan browser bukan penyimpanan data produksi.
