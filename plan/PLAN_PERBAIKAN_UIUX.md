# PLAN PERBAIKAN — POS Hybrid x Prototype "Warung Kapur"

> Tujuan: menutup selisih antara backend `POS_Hybrid` (Express 5 + PostgreSQL RLS) dan UI/UX prototype
> `Warung_Kapur__prototype_kasir__admin__dan_pelanggan_QR.html` (kasir, admin, pelanggan via QR meja).
>
> Dokumen ini turunan dari hasil audit. Setelah disetujui, ringkasannya dipindahkan ke `plan/PLAN.md`
> (aturan repo: jangan menambah file plan baru; PLAN.md adalah living document).

---

## 0. Ringkasan Temuan Audit

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | Tidak ada katalog menu (harga, foto, kategori, `is_available`) | Kasir dan pelanggan tidak punya daftar menu |
| 2 | Tidak ada meja dan token QR | Alur scan QR tidak bisa dibuat |
| 3 | Tidak ada endpoint publik pelanggan | Pelanggan tidak bisa pesan tanpa login |
| 4 | Status pesanan hanya `draft/completed/cancelled/refunded`, dan create langsung `completed` | Alur baru → diterima → diproses → siap → selesai tidak ada |
| 5 | Harga (`unit_price`) dikirim klien | Risiko manipulasi harga; tidak aman untuk pesanan QR |
| 6 | PPN hardcoded 0,11; diskon hanya per item; tanpa pembulatan rupiah | Total beda dengan prototype dan tidak bisa diatur admin |
| 7 | `payment_method` tanpa `qris`; tidak ada pembayaran manual (tunai/QRIS manual/EDC) | Modal bayar kasir tidak bisa dipetakan |
| 8 | Login email + password + `X-Tenant-ID` UUID | Tidak cocok untuk tablet kasir (prototype memakai PIN) |
| 9 | Tidak ada realtime untuk pesanan masuk | Badge "Pesanan masuk" tidak bisa live |
| 10 | Struk berbahasa Inggris, waktu UTC, `receipt_url` palsu | Tidak sesuai prototype dan tidak konsisten dengan laporan (Asia/Jakarta) |
| 11 | Laporan tanpa rentang bebas dan CSV | Halaman Laporan admin tidak lengkap |
| 12 | Tidak ada upload foto; body JSON maksimal 100 KB | Foto menu tidak bisa disimpan |
| 13 | `cors()` terbuka, tanpa rate limit, `limit/offset` tidak divalidasi | Wajib ditutup sebelum endpoint publik dibuka |
| 14 | PLAN.md tidak sinkron (2.1 tertulis belum, padahal sudah ada) | Dokumentasi menyesatkan |
| 15 | Segmen target PLAN (fashion chain) berbeda dengan prototype (kafe/warung) | Model data bergantung pada keputusan ini |

---

## 1. Keputusan yang Harus Diambil Dulu (Gate)

Fase B dan seterusnya bergantung pada jawaban ini. Isi sebelum mulai coding.

| ID | Pertanyaan | Rekomendasi | Keputusan |
|----|-----------|-------------|-----------|
| D1 | Segmen utama: kafe/warung (F&B) atau retail fashion? | Pilih satu untuk MVP. Prototype = F&B, jadi pakai model `menu_items` | ☐ |
| D2 | Katalog menu terpisah dari `inventory`, atau satu tabel? | Terpisah: `menu_items` opsional terhubung ke `inventory` via `sku` (`track_stock`) | ☐ |
| D3 | Stok dipotong kapan untuk pesanan QR? | Saat kasir **menerima** pesanan (bukan saat pelanggan kirim) agar pesanan spam/ditolak tidak mengurangi stok | ☐ |
| D4 | Pesanan QR yang belum dibayar dihitung di laporan? | Tidak. Hanya `status='completed'` dan `payment_status='paid'` | ☐ |
| D5 | PIN per staff atau per role? | Per staff (audit jelas). Admin tetap boleh email + password | ☐ |
| D6 | Storage foto: lokal, S3, atau data-URL kecil di DB? | Abstraksi storage; dev = lokal, prod = S3 | ☐ |
| D7 | Stack frontend | Disarankan PWA (Vite + React atau tetap vanilla seperti prototype) | ☐ |

---

## 2. Roadmap Fase

| Fase | Nama | Prioritas | Estimasi | Bergantung pada |
|------|------|-----------|----------|-----------------|
| A | Hardening dan kebersihan repo | P0 | 1–2 hari | — |
| B | Katalog menu, kategori, meja | P0 | 3–4 hari | D1, D2 |
| C | Model pesanan baru + kalkulasi server | P0 | 4–5 hari | B |
| D | API publik pelanggan (QR) | P0 | 3–4 hari | B, C, A |
| E | Alur kasir: status, bayar manual, realtime | P0 | 4–5 hari | C |
| F | Login PIN dan device pairing | P1 | 2–3 hari | A |
| G | Pengaturan toko, struk, laporan | P1 | 3–4 hari | C, E |
| H | Upload foto menu | P2 | 1–2 hari | B |
| I | Frontend PWA (kasir, admin, pelanggan) | P1 | 2–3 minggu | B–G |
| J | QA end-to-end dan rilis | P1 | 3–4 hari | I |

Estimasi untuk satu developer backend yang sudah paham codebase. Fase F dan H bisa paralel dengan fase lain.

---

## FASE A — Hardening dan Kebersihan Repo

**Tujuan:** menutup celah dasar sebelum ada endpoint publik.

### Tugas
- [ ] **CORS allowlist**: baca `CORS_ORIGINS` (comma-separated) dari env, tolak origin lain. Ganti `app.use(cors())` di `src/app.js`.
- [ ] **Rate limit**: tambah `express-rate-limit`. Default 100 req/menit/IP untuk API; limit lebih ketat untuk `/auth/*` (mis. 10/menit) dan `/public/*`.
- [ ] **Validasi pagination**: buat `paginationSchema` (Zod): `limit` 1–100 (default 20), `offset` ≥ 0. Pakai di `GET /pos/transactions` dan semua list lain.
- [ ] **Body limit**: `express.json({ limit: "100kb" })` eksplisit; foto lewat endpoint upload terpisah (Fase H).
- [ ] **Error handler**: buat `src/utils/api-error.js` dan `src/middleware/error-handler.js`, pindahkan blok error dari `app.js`. Sesuaikan dengan konvensi di PLAN.
- [ ] **README.md** root: cara setup DB, migrasi, `.env`, seed, `npm test`, `npm run dev`.
- [ ] **Migration runner** sederhana (`npm run migrate`) yang menjalankan `migrations/*.sql` berurutan dan mencatat di tabel `schema_migrations`.
- [ ] **CI** `.github/workflows/test.yml`: Postgres service + `npm test`.
- [ ] **Sinkronkan PLAN.md**: tandai 2.1 selesai (view `v_daily_sales` dengan `security_invoker`, bukan materialized view), perbarui daftar migrasi 001–010 dan jumlah test.

### Definition of Done
- Request dari origin tidak terdaftar ditolak; test untuk CORS dan rate limit lulus.
- `GET /pos/transactions?limit=abc` dan `limit=-1` mengembalikan 400.
- `npm test` hijau di CI.

---

## FASE B — Katalog Menu, Kategori, Meja

### Migrasi `011_catalog.sql`
```sql
categories(
  id UUID PK, merchant_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL, icon VARCHAR(30),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (merchant_id, LOWER(name)))

menu_items(
  id UUID PK, merchant_id UUID NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),          -- rupiah bulat
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,          -- tombol "Habis"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,             -- soft delete
  track_stock BOOLEAN NOT NULL DEFAULT FALSE,
  sku VARCHAR(100),                                     -- tautan opsional ke inventory
  sort_order INT NOT NULL DEFAULT 0)

dining_tables(
  id UUID PK, merchant_id UUID NOT NULL,
  number INT NOT NULL, token VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (merchant_id, number), UNIQUE (token))
```
- RLS enabled + forced + policy `*_isolation` seperti tabel lain; `GRANT` ke `pos_app`.
- **Lookup token meja tanpa tenant context**: pakai fungsi `SECURITY DEFINER` `lookup_table_by_token(token)` (pola sama dengan `lookup_payment_webhook` di migrasi 006). Fungsi hanya mengembalikan `merchant_id`, `table_id`, `number`. Tenant **tidak pernah** dari input bebas.
- Token: 24+ karakter acak dari `crypto.randomBytes` (base32/base64url), bukan 6 karakter seperti prototype.

### Endpoint
| Method | Path | Role | Keterangan |
|--------|------|------|-----------|
| GET/POST/PATCH/DELETE | `/admin/categories` | admin | CRUD; hapus ditolak (409) bila masih ada menu |
| POST | `/admin/categories/reorder` | admin | body: urutan id |
| GET/POST/PATCH/DELETE | `/admin/menu-items` | admin | CRUD; DELETE = soft delete |
| PATCH | `/pos/menu-items/:id/availability` | admin, manager, cashier | tombol Habis/Tersedia di kasir |
| GET | `/pos/menu` | semua staff | kategori + menu aktif, untuk layar kasir |
| GET/POST/DELETE | `/admin/tables` | admin | tambah/hapus meja |
| POST | `/admin/tables/:id/regenerate-token` | admin | token lama langsung tidak berlaku |

### Pemetaan ke prototype
Sidebar kategori + jumlah menu, grid menu, pencarian, mode "Atur stok", halaman admin Menu/Kategori/Meja dan QR.

### Test (`tests/ux-1-catalog.test.js`)
- CRUD kategori dan urutan; hapus kategori berisi menu → 409.
- Isolasi tenant: merchant A tidak bisa baca/ubah menu merchant B.
- Token lama ditolak setelah regenerate.
- Harga negatif ditolak.

---

## FASE C — Model Pesanan Baru dan Kalkulasi Server

### Prinsip
- Pisahkan **status pembukuan** (`status`: draft/completed/cancelled/refunded, sudah ada) dari **status dapur** (`fulfillment_status`, baru).
- Pesanan kasir yang dibayar langsung: `status='completed'`, `payment_status='paid'`, `fulfillment_status='selesai'` (atau sesuai alur dine-in).
- Pesanan QR: `status='draft'`, `payment_status='unpaid'`, `fulfillment_status='baru'`. Masuk laporan hanya setelah lunas (D4).
- **Harga selalu dari `menu_items`** di server. `unit_price` dari klien diabaikan untuk pesanan baru.

### Migrasi `012_orders.sql`
```sql
ALTER TABLE transactions
  ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'kasir' CHECK (source IN ('kasir','qr')),
  ADD COLUMN order_type VARCHAR(10) NOT NULL DEFAULT 'dine' CHECK (order_type IN ('dine','take')),
  ADD COLUMN table_id UUID REFERENCES dining_tables(id),
  ADD COLUMN table_number INT,
  ADD COLUMN customer_name VARCHAR(24),
  ADD COLUMN fulfillment_status VARCHAR(12) NOT NULL DEFAULT 'baru'
    CHECK (fulfillment_status IN ('baru','diterima','diproses','siap','selesai','ditolak')),
  ADD COLUMN reject_reason VARCHAR(60),
  ADD COLUMN daily_number INT,
  ADD COLUMN discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,     -- snapshot saat transaksi
  ADD COLUMN public_token VARCHAR(32);                    -- akses status oleh pelanggan

ALTER TABLE transaction_items
  ADD COLUMN note VARCHAR(60),
  ADD COLUMN menu_item_id UUID REFERENCES menu_items(id);

-- tambah 'qris' ke CHECK payment_method (transactions dan payments)
CREATE TABLE order_counters(
  merchant_id UUID, day DATE, last_number INT NOT NULL,
  PRIMARY KEY (merchant_id, day));   -- INSERT ... ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING
```
- `daily_number` mengikuti tampilan `#001` di prototype (reset per hari, zona Asia/Jakarta). `order_number` lama tetap ada untuk kompatibilitas idempotency.
- Index: `(merchant_id, source, fulfillment_status, created_at DESC)` untuk daftar pesanan masuk.

### Kalkulasi (satu fungsi di service, dipakai kasir dan publik)
```
subtotal = Σ price × qty
diskon   = round(subtotal × discount_pct / 100)
pajak    = round((subtotal − diskon) × tax_pct / 100)
total    = subtotal − diskon + pajak          // semua integer rupiah
```
- Ganti `subtotal * 0.11` di `transaction.service.js`. `tax_pct` dan preset diskon dibaca dari pengaturan merchant (Fase G); preset diskon divalidasi terhadap daftar yang diizinkan.
- Hindari float: simpan sebagai integer rupiah atau `NUMERIC` dengan pembulatan eksplisit; ubah `::float` di view analytics menjadi `NUMERIC`.

### Test (`tests/ux-2-orders.test.js`)
- Total sama dengan rumus prototype untuk beberapa kombinasi (diskon 0/5/10, PPN 11).
- `unit_price` dari klien diabaikan.
- Nomor harian berurutan dan tidak duplikat saat 20 request paralel.
- Pesanan `draft` tidak muncul di `/pos/dashboard/today` dan `/pos/reports/*`.
- Idempotency-Key tetap berfungsi.

---

## FASE D — API Publik Pelanggan (Scan QR)

### Endpoint (tanpa JWT, tenant dari token meja)
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/public/tables/:token/menu` | Nama toko, nomor meja, kategori, menu (hanya aktif), PPN. `404` bila token salah |
| POST | `/public/tables/:token/orders` | Kirim pesanan; mengembalikan `order_id` + `public_token` |
| GET | `/public/orders/:id?pt=<public_token>` | Status pesanan + rincian (untuk halaman Status pesanan) |

### Aturan keamanan
- Rate limit ketat per IP dan per token meja (mis. 10 pesanan/10 menit/meja).
- Zod strict: maks 30 item, qty 1–20, `note` ≤ 60 karakter, `customer_name` ≤ 24 karakter, `payment_pref` ∈ `kasir|qris`.
- Menu `is_available=false` ditolak (409) dengan pesan yang jelas untuk pelanggan.
- Wajib `Idempotency-Key` agar tombol "Kirim pesanan" yang ditekan dua kali tidak membuat pesanan ganda.
- Pelanggan hanya bisa melihat pesanannya sendiri lewat `public_token`; tidak ada endpoint list.
- Respons tidak membocorkan `merchant_id`, data staff, atau ID internal lain.
- Sanitasi teks (catatan, nama) di server; prototype hanya membuang `<>&"'` di klien.

### Pemetaan ke prototype
Halaman pelanggan: daftar menu + pencarian + chip kategori, lembar "Pesanan Anda" (catatan per item, nama pemesan, pilihan Bayar di kasir/QRIS), halaman Status (tahap Diterima → Dibuat → Siap diantar → Selesai, alasan bila ditolak, QR pembayaran).

### Test (`tests/ux-3-public.test.js`)
- Token salah → 404; token yang sudah di-regenerate → 404.
- Harga dari server; menu habis ditolak.
- Rate limit aktif; Idempotency mencegah duplikat.
- `public_token` salah tidak bisa membaca pesanan.

---

## FASE E — Alur Kasir: Status, Bayar Manual, Realtime

### State machine `fulfillment_status`
```
baru → diterima → diproses → siap → selesai
baru → ditolak (wajib reject_reason)
```
- Transisi di luar aturan → 409. `selesai` hanya boleh bila `payment_status='paid'` (sesuai tombol "Selesaikan" di prototype yang disabled sebelum lunas).
- Stok (D3): dipotong saat `baru → diterima` untuk menu `track_stock`; dikembalikan bila pesanan dibatalkan setelah diterima. Pakai mekanisme `FOR UPDATE` yang sudah ada di `inventory.service.js`.

### Endpoint
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/pos/orders?source=&status=&date=` | Daftar pesanan masuk (filter chip: Semua/Baru/Diproses/Siap/Selesai) |
| POST | `/pos/orders` | Pesanan dari kasir (dine/take, meja, diskon %, item) |
| PATCH | `/pos/orders/:id/status` | `{ status, reject_reason? }` |
| POST | `/pos/orders/:id/pay` | `{ method: tunai|qris|kartu, received? }` → hitung kembalian di server; `409` bila uang kurang |
| GET | `/pos/orders/stream` | Realtime pesanan baru/berubah (SSE) |

- **Provider pembayaran `manual`**: tambah ke CHECK `payments.provider`. `qris` manual = kasir menekan "Tandai lunas" (kasus warung tanpa gateway); gateway Xendit/Stripe tetap lewat adapter yang ada dan webhook terverifikasi. Mode dipilih per merchant di pengaturan.
- Catat audit: siapa yang menerima, menolak, dan menandai lunas.

### Realtime
- Pilih SSE (satu arah, cukup untuk badge dan daftar). `EventSource` tidak bisa mengirim header Authorization → gunakan tiket stream berumur pendek: `POST /pos/orders/stream-ticket` → `GET /pos/orders/stream?ticket=...`, atau `fetch` streaming dengan header.
- Fallback polling `GET /pos/orders?since=<timestamp>` tiap 5–10 detik bila SSE putus.
- Sisi pelanggan: polling `GET /public/orders/:id` tiap 5–10 detik (tanpa SSE).

### Test (`tests/ux-4-kasir.test.js`)
- Semua transisi valid dan invalid.
- Bayar tunai: kembalian benar, uang kurang ditolak.
- `selesai` sebelum lunas ditolak.
- Stok berkurang saat diterima, kembali saat batal; tidak ada oversell pada penerimaan paralel.
- Event SSE terkirim ke merchant yang benar saja (tes isolasi).

---

## FASE F — Login PIN dan Device Pairing

### Masalah
Login sekarang butuh email + password + `device_id` + header `X-Tenant-ID` berupa UUID. Kasir di tablet tidak akan mengetik itu.

### Rancangan
- Migrasi: `staff.pin_hash` (argon2), `staff.pin_failed_count`, `staff.pin_locked_until`; `merchants.code` (kode pendek unik, mis. `warung-kapur`).
- **Pairing perangkat sekali**: admin login (email + password) → buat kode pairing → tablet memasukkan kode → server menyimpan `device_id` + merchant pada perangkat.
- `POST /auth/pin-login` `{ merchant_code | device_token, staff_id, pin, device_id }` → access + refresh token seperti login biasa.
- PIN 4–6 digit; lockout 5 kali gagal selama 5 menit; rate limit; audit ke `auth_audit_logs`.
- Layar login prototype (pilih peran lalu keypad PIN) menjadi: pilih nama staff → keypad PIN.
- Admin: pertimbangkan wajib email + password (atau PIN + 2 langkah) karena PIN 4 digit lemah untuk hak admin.
- `ALLOW_DEV_LOGIN` hanya development; pastikan tetap tertolak di production (sudah ada).

### Test (`tests/ux-5-pin.test.js`)
- PIN benar/salah, lockout, reset lockout setelah waktu habis, isolasi tenant, PIN tidak pernah tercatat di log.

---

## FASE G — Pengaturan Toko, Struk, Laporan

### G1. Pengaturan toko
- Tabel `merchant_settings` (1 baris per merchant): `store_name`, `tax_pct`, `discount_presets INT[]`, `payment_mode` (manual|gateway), `qris_static_url` (opsional).
- `GET/PATCH /admin/settings` (validasi: tax 0–30, preset 0–100 dan unik). `GET /pos/settings` read-only untuk kasir (preset diskon, PPN).

### G2. Struk
Perubahan di `receipt.service.js`:
- [ ] Label Indonesia: STRUK, Kasir, Pesanan #001, Subtotal, Diskon, PPN 11%, Total, Metode, Diterima, Kembalian, "Terima kasih, sampai ketemu lagi!".
- [ ] Tampilkan "Makan di sini, meja N" atau "Bawa pulang", dan "Dipesan lewat QR" bila `source='qr'`.
- [ ] Waktu pakai zona **Asia/Jakarta** (sama dengan laporan), format `dd/MM/yyyy, HH.mm`.
- [ ] Hapus `receipt_url` palsu; isi hanya bila ada domain struk digital yang nyata (env `RECEIPT_BASE_URL`).
- [ ] Format `json` ikut menyertakan field baru sehingga frontend bisa menggambar struk di layar.

### G3. Laporan
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/pos/reports/range?from=&to=&source=&method=&limit=&offset=` | Daftar transaksi + ringkasan (penjualan, jumlah, rata-rata) |
| GET | `/pos/reports/range.csv` | Ekspor CSV (UTF-8 BOM agar Excel membaca benar) |
| GET | `/pos/reports/series?days=7` | Penjualan harian untuk grafik batang |

- Dashboard `top_products` sudah ada; pastikan parameter 7 hari tersedia untuk "Menu terlaris, 7 hari".
- Validasi `from ≤ to`, maksimal rentang 366 hari.

### Test (`tests/ux-6-settings-reports.test.js`)
- Perubahan PPN memengaruhi transaksi baru, bukan yang lama (snapshot `tax_pct`).
- Struk berisi field baru dan zona waktu benar; CSV valid dan angka cocok dengan laporan.

---

## FASE H — Upload Foto Menu

- `POST /admin/menu-items/:id/image` (multipart, `multer`): maksimal 2 MB, hanya `image/jpeg|png|webp`, cek magic bytes, resize dengan `sharp` (mis. maks 800 px, WebP).
- Abstraksi `storage.adapter.js` (lokal untuk dev, S3 untuk prod sesuai rencana 4.1); simpan hanya URL di `menu_items.image_url`.
- `DELETE /admin/menu-items/:id/image`.
- Frontend tetap menampilkan placeholder ikon kategori bila tidak ada foto (perilaku prototype).

---

## FASE I — Frontend PWA

### Struktur layar (dari prototype)
| Area | Layar | Endpoint utama |
|------|-------|----------------|
| Login | Pilih staff + PIN | `/auth/pin-login` |
| Kasir | Menu + tiket pesanan, atur stok | `/pos/menu`, `/pos/orders`, `/pos/menu-items/:id/availability` |
| Kasir | Pesanan masuk | `/pos/orders`, stream, `/pos/orders/:id/status` |
| Kasir | Bayar (tunai/QRIS/kartu), struk | `/pos/orders/:id/pay`, `/pos/transactions/:id/receipt?format=json` |
| Kasir | Riwayat hari ini | `/pos/reports/range` |
| Admin | Ringkasan | `/pos/dashboard/today`, `/pos/reports/series` |
| Admin | Menu, Kategori, Meja dan QR | `/admin/menu-items`, `/admin/categories`, `/admin/tables` |
| Admin | Laporan + CSV | `/pos/reports/range(.csv)` |
| Admin | Pengaturan | `/admin/settings` |
| Pelanggan | Menu, keranjang, status | `/public/tables/:token/*`, `/public/orders/:id` |

### Yang dipertahankan dari prototype
- Gaya papan tulis/whiteboard, tema gelap/terang, bingkai berbeda per peran (kasir garis tunggal, admin ganda, pelanggan tipis).
- Sidebar ciut, drawer di layar kecil, target sentuh minimal 44 px, fokus terlihat.
- Bahasa Indonesia penuh dan format `Rp 12.000`.

### Yang harus diperbaiki saat porting
- Ganti `localStorage` + `BroadcastChannel` sebagai sumber data dengan API; simpan di klien hanya sesi dan preferensi tema.
- Tambah **antrean offline** (IndexedDB) untuk pesanan kasir dengan `Idempotency-Key` (melengkapi fase 1.5 yang menunggu PWA), indikator "Offline" dan "Menyinkronkan".
- Tangani status loading dan error jaringan di semua aksi (prototype tidak perlu).
- Pesan error ramah untuk pelanggan (menu habis, token meja tidak valid, terlalu banyak permintaan).
- Pelanggan tidak boleh melihat tombol/URL admin; routing berbasis peran di klien **dan** diperiksa server.
- Cetak struk dari browser memakai `format=text`/`json`; cetak kartu meja QR dibuat dari QR server atau library QR di klien.
- Pengujian aksesibilitas dasar: kontras (terutama tema terang), label form, urutan fokus modal.

---

## FASE J — QA End-to-End dan Rilis

- [ ] Skenario e2e: pelanggan scan → pesan → kasir terima → proses → siap → bayar tunai → selesai → muncul di laporan dan struk.
- [ ] Skenario QRIS manual dan penolakan pesanan dengan alasan.
- [ ] Uji beban ringan endpoint publik (rate limit, tidak ada kebocoran antar tenant).
- [ ] Uji perangkat: tablet kasir (landscape), HP pelanggan (portrait), tema gelap/terang.
- [ ] Uji offline: kasir buat pesanan tanpa internet, sinkron tanpa duplikat.
- [ ] Review keamanan: token meja, `public_token`, PIN lockout, CORS, header helmet.
- [ ] Update PLAN.md (tabel PROGRESS + ringkasan) dan README.

---

## 3. Standar Pengerjaan (mengikuti konvensi repo)

- Alur `Route → Controller → Service → Repository → PostgreSQL`; validasi Zod per route; semua query lewat `withTenantContext`.
- Tabel baru: RLS `ENABLE` + `FORCE`, policy `*_isolation`, `GRANT` ke `pos_app` saja (tanpa BYPASSRLS).
- Tenant selalu dari JWT atau dari token meja yang diverifikasi lewat fungsi `SECURITY DEFINER`, bukan input bebas.
- Test per fase di `tests/ux-N-*.test.js`, skip bila DB tidak tersedia, memakai merchant khusus agar aman paralel.
- Tidak ada secret di kode atau test; jangan log PIN, token, atau data kartu.

## 4. Definition of Done (per fase)

1. `npm test` hijau (semua test lama tetap lulus).
2. Isolasi tenant terbukti oleh test untuk setiap tabel/endpoint baru.
3. Migrasi idempotent dan bisa dijalankan dari database kosong.
4. Dokumentasi: PLAN.md (PROGRESS + ringkasan) dan README diperbarui.
5. Untuk fase yang menyentuh UI: sudah dibandingkan dengan prototype dan semua perbedaan disengaja tercatat.

## 5. Risiko dan Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Keputusan segmen (D1) berubah di tengah jalan | Selesaikan Gate di bagian 1 sebelum Fase B |
| Perubahan semantik `status` merusak laporan dan analytics yang sudah ada | Fase C menambah kolom baru, tidak mengubah arti `completed`; test regresi untuk dashboard, reports, analytics, HR komisi |
| Endpoint publik disalahgunakan (spam pesanan, scraping menu) | Rate limit per IP dan per meja, token meja panjang dan bisa dirotasi, pesanan QR tidak memotong stok sampai diterima |
| Migrasi pada data yang sudah ada | Semua kolom baru punya default; backfill `daily_number` dan `fulfillment_status='selesai'` untuk transaksi lama |
| PIN 4 digit lemah | Lockout, rate limit, audit, admin tetap email + password |
| Float pada uang | Integer rupiah dan pembulatan eksplisit di satu fungsi kalkulasi |
| Realtime tidak stabil di jaringan warung | Fallback polling dan indikator koneksi di UI |

## 6. Checklist Pembaruan PLAN.md Setelah Disetujui

- [ ] Tambah bagian "Fase UX (kafe/warung)" di roadmap teknis dengan Fase A–J di atas.
- [ ] Perbarui tabel PROGRESS (tandai 2.1 selesai; tambahkan fase baru sebagai ⬜).
- [ ] Perbarui daftar migrasi menjadi 001–012 (dan seterusnya).
- [ ] Pindahkan "Backlog frontend" menjadi Fase I.
- [ ] Catat keputusan D1–D7 di bagian "Keputusan desain kunci".
