# POS HYBRID — MASTER PLAN (dokumen tunggal)

> Dokumen ini mengompaktasi seluruh file plan sebelumnya (business plan, GTM, roadmap teknis,
> panduan phase 1.1 & 1.2/1.3, templates) menjadi satu file.
> ATURAN UPDATE: setiap kali satu phase selesai dikerjakan, perbarui bagian "PROGRESS"
> (tandai phase sebagai selesai + ringkasan apa yang dibuat) dan bagian "RENCANA BERIKUTNYA"
> (detail langkah phase berikutnya). Jangan menambah file plan baru.

---

## 1. Ringkasan Bisnis

### Konsep
POS Hybrid adalah platform point-of-sale berbasis subscription untuk retail Indonesia, dengan fokus **fleksibilitas device** (API-first, tanpa hardware lock-in), **transparansi pricing** (MDR rendah, tanpa biaya tersembunyi), dan **support lokal 24/7**. Target utama: multi-unit retail chains (fashion/apparel) yang sudah omnichannel.

**UVP**: *"Cloud-based POS platform yang fleksibel, terjangkau, dan dilengkapi omnichannel untuk retail Indonesia yang ingin skala tanpa vendor lock-in."*

### Masalah yang Diselesaikan
- **Inventory overselling** antara toko fisik dan marketplace (Tokopedia/Shopee) — sinkronisasi real-time.
- **Data omnichannel manual** — 2+ jam/hari update inventory/order antar sistem → otomatisasi.
- **POS mahal + hardware lock-in** (Square Rp2M+/bulan + beli Terminal) — Rp99k–1,5M, device bebas.
- **MDR tinggi** (2%+) — pass-through 0,8–1,2%.
- **Support English-only** — 24/7 Bahasa Indonesia.
- **Staff management berantakan** — modul HR/KPI built-in.

### Target Market
- **TAM**: ~2,5M retail stores Indonesia (~500K sudah ingin POS software) ≈ Rp7,5T.
- **SAM**: SME & mid-market chains yang sudah online.
- **SOM (3 tahun)**: 10K merchants = Rp36M ARR (target konservatif primer: 300 fashion chains = Rp4,2B).
- **Segmen primer**: multi-unit fashion/apparel (~3K chains, 5–50 lokasi, sales Rp300M–5B/bulan, bayar Rp1–2M/bulan). Sekunder (Y2+): QSR/kafé (~2K), farmasi (~5K), elektronik (~3K).

### Product Pillars
1. **Core POS** — transaksi multi-lokasi/multi-cashier, offline mode, deduksi inventory real-time, struk (thermal/digital).
2. **Payment Gateway** — Stripe, Xendit, QRIS (adapter seragam), MDR 0,8–1,2% transparan, settlement & rekonsiliasi otomatis, deteksi fraud.
3. **Omnichannel** (Month 6) — sync Tokopedia + Shopee + WooCommerce, unified order management, Click & Collect.
4. **Intelligence & Operations** (Month 9–12) — dashboard real-time, analytics, HR (shift, komisi, KPI), CRM/loyalty, accounting integration.

### Revenue Streams & Pricing

| Tier | Harga/bulan | Target | Fitur kunci |
|------|------------|--------|-------------|
| **Starter** | Rp99k | Solo merchant, 1 lokasi | Core POS, 1 cashier, reporting basic |
| **Growth** | Rp299k | SME 2–10 toko | + Multi-location, 5 cashier, analytics, HR basic, loyalty |
| **Pro** | Rp1.499k | Chains 10–50 toko | + Omnichannel, advanced analytics, CRM, API/webhooks, unlimited |
| **Enterprise** | Custom | 50+ toko | + White-label, custom dev, dedicated CSM |

- Addon: +Rp50k/cashier tambahan; diskon multi-lokasi -10% (3 lokasi) s/d -20% (10+); annual prepay -15%; komitmen 36 bulan -20%.
- **Payment commission**: 0,5–1,5% (CC 1,5%, e-wallet 0,8%, transfer 0,3%).
- **Services**: implementasi/training Rp2–5M, custom dev Rp500k–2M/hari, migration Rp1–3M.
- **Marketplace**: komisi app marketplace 30%; developer API tier (free/Basic Rp99k/Pro Rp499k).

### Proyeksi Finansial 3 Tahun (ringkas)

| | Year 1 | Year 2 | Year 3 |
|---|--------|--------|--------|
| Merchants | 1.000 | 10.000 | 50.000 |
| Revenue | Rp22B | Rp200B | Rp960B |
| Gross margin | 64% | 65% | 66% |
| EBITDA | (Rp18,6B) | Rp21B | Rp390B |

- Funding Y1: Rp3,6B (payroll Rp1,6B, infra Rp400M, dev Rp600M, S&M Rp500M, ops Rp300M, contingency Rp200M). Burn ~Rp300M/bulan, break-even Q4 Year 2.
- **Unit economics (Growth tier)**: revenue Y1/merchant Rp14,1M (sub Rp9M + komisi Rp3,6M + services Rp1,5M); CAC Rp8M; payback 7 bulan; LTV (3Y, churn 2%/bln) Rp36M; LTV:CAC 4,5:1; gross margin 85,8%.
- Churn management: kontrak minimum 12 bulan, termination penalty Rp2M, switching cost (migration fee), success check-in, target <5%/bulan.

---

## 2. Strategi GTM & Kompetitif

### 3-Phase GTM
1. **Phase 1 — PMF (Bulan 1–6)**: 50 beta merchant via founder-led sales, insentif diskon 50%, kontrak 6 bulan. Metrik: demo→trial 50%, trial→paid 80%, NPS ≥50, time-to-value <7 hari.
2. **Phase 2 — Growth (Bulan 7–18)**: 1.000 merchant. Hire VP Sales (M7) + 2 AE (M9/M15); reseller program (Silver 20% / Gold 25% / Platinum 30% margin); digital marketing Rp200M (Google Ads 40%, FB/IG 25%, content 20%, events 15%); partnership payment gateway & marketplace.
3. **Phase 3 — Scale (Year 2+)**: 10K merchant, self-serve/referral, ekspansi segmen (QSR, farmasi) & internasional (PH, SG/MY), app marketplace/ISV.

### Positioning vs Kompetitor
| Kompetitor | Kelemahan utama | Counter-message |
|------------|-----------------|-----------------|
| **Square** | Hardware-bound, MDR 2–2,5%, support English-only | "Fitur sama, setengah harga, support lokal" |
| **iZettle** | Omnichannel lemah, HR & reporting basic | "iZettle untuk single store. POS Hybrid untuk chains." |
| **Toast** | F&B-specific, over-engineered untuk retail, mahal | Retail-first, harga masuk akal |
| **Moka** | Omnichannel/API/HR terbatas, scalabilitas SME-only | "Start with Moka, scale with POS Hybrid." |

**Niche kita**: feature-rich (seperti Square/Toast) + affordable (seperti Moka) + local support (seperti iZettle) + flexible device (unik). Pesan: *"Satu POS untuk semua channel."*

### Kanal Akuisisi Kunci
- Direct sales (founder → sales team), CAC Rp8M (Y1) → Rp4M (Y2 via scale).
- Reseller/channel partners (POS distributors, payment processors, konsultan retail).
- Digital: Google Ads ("POS Indonesia", "omnichannel POS"), content/webinar, case study.
- Partnership: co-marketing Stripe/Xendit, listing di Tokopedia/Shopee "Tools & Integrations".
- Sales cycle 2–4 minggu: qualification → demo/trial 14 hari → pilot → nego → implementasi 2–4 minggu.

### Pricing Strategy
- Anchor: hemat ~Rp800k/tahun vs Square untuk tier Growth tanpa trade-off fitur.
- Diskon: volume lokasi, annual prepay, multi-year, referral (kredit Rp500k).
- Objection handling: fokus TCO & ROI (omnichannel mencegah overselling Rp50M/bulan), bukan harga per bulan.

---

## 3. Roadmap Teknis Lengkap

Stack: **Node.js 20+ / Express 5 / PostgreSQL (RLS multi-tenant)** — backend-only awalnya; frontend PWA `frontend/` sudah Vite+React 19 (UI Alignment ✅).
Alur arsitektur: `Route → Controller → Service → Repository → PostgreSQL` (monolith modular, microservices disiapkan untuk skala).

### Phase 1: MVP Core POS

| Sprint | Status | Ringkasan implementasi aktual |
|--------|--------|-------------------------------|
| **1.1 Auth & Multi-Tenancy** | ✅ | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `/auth/dev-login`. JWT access/refresh (claims: `sub`, `merchant_id`, `role`). Middleware `authenticate`, `authorize([...roles])`, `tenant-context` (withTenantContext + `set_config('app.merchant_id', ..., true)` per transaksi). RBAC: admin/manager/cashier/integration. Argon2 hashing. API keys (`/admin/api-keys` CRUD, revoke). Tabel: `merchants`, `staff` (+ `auth_audit_logs`, refresh tokens). RLS enabled+forced, policy `merchants_isolation` & `staff_isolation` via `current_setting('app.merchant_id')`. Migrasi `001`–`002`, `005`. |
| **1.2 Transaksi POS** | ✅ | `POST/GET/PATCH/DELETE /pos/transactions`, `GET /pos/transactions/:id`. Tabel `transactions` + `transaction_items` (subtotal, tax, discount, total, payment_status, reference_number, metadata). Migrasi `003`–`004` (RLS transaksi). Atomic flow: validasi → insert header+items → deduksi stok atomik (FOR UPDATE / `quantity >= qty`) → audit. |
| **1.3 Payment Gateway** | ✅ | Adapter contract seragam (`payment-adapter.js`, `payment-factory.js`) untuk Stripe, Xendit, QRIS + Dummy. Endpoints: `POST /pos/transactions/:id/payments`, `GET /pos/payments/:id`, `POST /pos/payments/:id/cancel|refund`. Webhook: `POST /webhooks/payment/completion` (+ route per-provider) — raw body, signature verification, dedup `(provider, event_id)`, update atomic payment+transaction. Tabel `payments`, `payment_webhook_events`; kolom payment di transactions. State machine: pending→paid/failed/expired; paid→refunded (tolak transisi balik). Rekonsiliasi: `POST /admin/payments/reconcile`, retry webhook. Migrasi `006`. |
| **1.4 Receipt Printing** | ✅ | `GET /pos/transactions/:id/receipt` — format via query param: `text`, `escpos`, `json`. Data: merchant info, items, totals, payment method, QR. `receipt.service.js`. |
| **1.5 Offline/Idempotency** | ✅ | `Idempotency-Key` header pada `POST /pos/transactions` (atau `idempotency_key` di body). Kolom `idempotency_key` di tabel `transactions` + partial unique index `(merchant_id, idempotency_key)` (migrasi `008`). Replay key sama → `200` + `replayed: true` + data transaksi lama; stok tidak dipotong dua kali; race unique violation (23505) ditangkap → fetch existing. Offline queue sync (client IndexedDB) menunggu frontend PWA. |
| **1.6 Inventory** | ✅ | Tabel `inventory` (UNIQUE merchant+sku — tanpa location, single-warehouse), `inventory_movements` (audit trail, insert-only). Anti-oversell: lock `FOR UPDATE` + guard stok, gagal = `StockError` 409 + rollback. Admin CRUD: `GET/POST/PATCH /admin/inventory`, `/admin/inventory/adjust`, `/admin/inventory/movements`. Cek stok: `GET /pos/inventory/availability?sku=...` (status optimal/low/critical/out_of_stock). Deduksi saat create transaksi; restock saat delete & edit & refund penuh (`return`). Migrasi `007`. |
| **1.7 Dashboard & Reporting** | ✅ | `GET /pos/dashboard/today` (query `date`/`from`/`to`, default hari ini, timezone Asia/Jakarta): summary (count/total/average), `payment_breakdown` per method, `top_products` (10), `hourly_sales` 24 baris. `GET /pos/reports/daily` (admin/manager), `GET /pos/reports/weekly` (7 hari), `GET /pos/reports/monthly` (N hari per bulan) — semua dari agregasi `transactions`/`transaction_items` (status completed), validasi tanggal kalender via zod refine. `reports.repository.js`, `reports.service.js`, `reports.schema.js`. Test pakai merchant khusus (provision inline) supaya aman terhadap test paralel. |

**Keputusan desain kunci Phase 1:**
- **RLS sebagai isolation boundary**: tenant TIDAK pernah dari input bebas/payload webhook — selalu dari JWT (`request.auth.merchant_id`) via `set_config('app.merchant_id', ..., true)` di awal transaksi DB (isolation level transaction-local karena pg pool multiplexing). `FORCE ROW LEVEL SECURITY`; role app `pos_app` tanpa BYPASSRLS.
- **Atomic stock deduction**: `UPDATE inventory SET quantity = quantity - $q WHERE ... AND quantity >= $q` — gagal = insufficient stock, tanpa oversell.
- **Payment async**: create payment = `pending` saja; status `paid` hanya dari webhook terverifikasi (signature + amount match + dedup event).
- **Idempotency**: webhook (dedup event_id) dan client transaction (`Idempotency-Key`) — aman retry/duplicate/out-of-order.

### Phase 2: Analytics & Operations (Month 7–12) — ringkas
- **2.1 Advanced Analytics** ✅: migrasi `010_analytics.sql` — view `v_daily_sales` (`security_invoker = true`, RLS tetap berlaku tanpa matview+refresh). Endpoints: `GET /admin/analytics/sales-by-product?from=&to=&limit=`, `/margin?from=&to=&limit=` (revenue − qty×`COALESCE(inventory.unit_cost,0)`, null-safe `has_cost`), `/slow-moving?days=&limit=` (inventory tanpa penjualan N hari), `/turnover?from=&to=&limit=` (sold/current_stock estimasi). Files: `analytics.schema/repository/service/controller.js`, routes di `admin.routes.js`. Test: `tests/phase-2-1.test.js` (8 test, merchant khusus inline).
- **2.2 HR/Staff** ✅: migrasi `009_hr_staff.sql` — kolom HR di `staff` (hire_date, employment_type, hourly_rate, monthly_salary, commission_rate) + tabel `shifts` (UNIQUE per staff/hari, cek overlap), `timesheets` (satu clock-in terbuka per staff via unique partial index), `commissions` (UNIQUE per staff/hari → upsert idempotent). Endpoints: CRUD `/admin/hr/shifts`, `GET /admin/hr/timesheets`, `GET /admin/hr/staff-performance?from=&to=` (agregat transaksi per cashier), `PATCH /admin/hr/staff/:id` (field HR), `POST /admin/hr/commissions/calculate?date=`, `GET /admin/hr/commissions`, `PATCH /admin/hr/commissions/:id` (paid); clock `/pos/hr/clock-in|clock-out` (admin/manager/cashier, auto-link shift hari ini). Files: `hr.schema/repository/service/controller.js`, `tests/phase-2-2.test.js` (14 test, merchant khusus).

### Phase 3: Omnichannel & Ecosystem (Month 13–18) — ringkas
- **3.1 E-Commerce Connector** ✅: migrasi `011_ecommerce.sql` — tabel `ecommerce_connections` (marketplace enum, credentials ter-encrypt AES-256-CBC, UNIQUE merchant+store), `ecommerce_orders` (UNIQUE connection+marketplace_order_id, status enum pending→confirmed→shipped→delivered/cancelled/refunded), `ecommerce_order_items` (RLS via subquery ke orders). Adapter pattern: `base-adapter.js` (interface), `dummy-adapter.js` (fetchOrders/fetchOrder/updateFulfillment/pushInventory/verifyWebhook/normalizeWebhook), `factory.js` (tokopedia/shopee/woocommerce placeholder). Endpoints: CRUD `/admin/ecommerce/connections`, `POST /connections/:id/sync` (pull orders via adapter, upsert idempotent), `POST /connections/:id/push-inventory`, `GET /ecommerce/orders?status=&from=&to=`, `GET /ecommerce/orders/:id` (dengan items), `PATCH /ecommerce/orders/:id/fulfill` (status + tracking ke raw_payload). Files: `ecommerce.schema/repository/service/controller.js`, `tests/phase-3-1.test.js` (19 test, merchant khusus + RLS cross-merchant).
- **3.2 Click & Collect** ✅: migrasi `012_click_and_collect.sql` + `012b_cnc_movement_types.sql` — tabel `click_and_collect_orders` (source_order_id nullable FK ecommerce_orders, pickup_code VARCHAR(8) UNIQUE per merchant, status pending→ready→picked_up→expired/cancelled, expires_at 24 jam, partial index pending-expiry untuk cleanup). Alur: create reservation = validasi stok (FOR UPDATE) + physical deduct (movement `cnc_reserve`) + generate pickup_code unik; verify pickup = by pickup_code, stok tidak di-deduct ulang (sudah hold); cancel = restock (`cnc_cancel`); expire batch = restock (`cnc_expire`). Endpoints: `POST /admin/click-and-collect`, `GET /click-and-collect?status=`, `GET /click-and-collect/:id`, `POST /click-and-collect/verify` (body pickup_code), `POST /click-and-collect/:id/cancel`, `POST /click-and-collect/expire`. Files: `click-and-collect.schema/repository/service/controller.js`, `tests/phase-3-2.test.js` (13 test, merchant khusus + RLS cross-merchant).
- **3.3 Accounting** ✅: migrasi `013_accounting.sql` — tabel `accounting_connections` (provider xero/myob/quickbooks/dummy, credentials ter-encrypt, UNIQUE merchant+provider), `journal_entries` (CHECK total_debit=total_credit, partial unique per merchant+date+ref via index), `journal_lines` (CHECK debit XOR credit), `tax_invoices` (DPP, PPN rate 11%/12%, faktur_pajak_number, UNIQUE merchant+invoice_number). GL mapping: Cash 1000, AR 1200, Inventory 1300, Sales 4100, COGS 5100, PPn Keluaran 2100. Journal harian: agregasi transaksi completed per hari (Asia/Jakarta) → DR Cash (grand_total), CR Sales (DPP), CR Tax, DR COGS (est. dari unit_cost), CR Inventory. Tax invoice: DPP=sum(qty×price), PPN=DPP×rate, issue → generate faktur_pajak_number (format 010.000-26.XXXXX). Adapter: accounting `base-adapter.js`, `dummy-adapter.js`, `factory.js`. Endpoints: CRUD `/admin/accounting/connections`, `POST /connections/:id/sync` (push journal posted), `POST /journal/daily?date=`, `GET /journal?from=&to=&status=`, `GET /journal/:id`, `POST /journal/:id/post`, `POST/GET /tax-invoices`, `POST /tax-invoices/:id/issue`. Files: `accounting.schema/repository/service/controller.js`, `tests/phase-3-3.test.js` (18 test, merchant khusus + RLS cross-merchant).

### Infrastructure & Deployment (4.1–4.3) — ringkas
- **4.1 Cloud** ⬜: AWS — CloudFront → ALB → ECS (API/Web) + RDS PostgreSQL + ElastiCache Redis + S3 (receipts) + SQS (jobs) + SNS. IaC Terraform; CI/CD GitHub Actions (test per PR, staging auto, prod manual approval, blue-green).
- **4.2 Monitoring & Rate Limiting** ✅: Rate limiting in-memory (`middleware/rate-limit.js`, fixed window per IP, global 100 req/menit + /auth 10 req/menit, `X-RateLimit-*` headers, 429 + `Retry-After`; nonaktif di test kecuali `forceInTest`). Request ID tracing (`middleware/request-id.js` — safe regex, `X-Request-Id`). Metrics service (`services/metrics.service.js` — counters HTTP/payment/webhook, latency ring buffer per route → p50/p95/p99, status buckets, `payment_success_rate`). Metrics middleware + `GET /metrics`. Pino-http dengan `genReqId`. Trust proxy (`TRUST_PROXY=1`).
- **4.3 Security & Cache** ✅: CORS allowlist (`CORS_ORIGINS` comma-separated; kosong = allow all dev-only; origin tanpa header = curl/mobile diizinkan). Helmet (CSP off untuk JSON API). Express body limit 1mb. Cache layer (`config/cache.js`) — Redis opsional via `REDIS_URL` (dynamic require `redis`, fallback in-memory TTL bila koneksi gagal); API `get/set/del/delNamespace`, namespace per fitur. Inventory availability di-cache per-SKU (`inv-avail:{merchant}:{sku}`, TTL `INVENTORY_CACHE_TTL_SECONDS` default 300s) + invalidasi saat stok berubah (sale via `applyStockDeltas`, adjust, return). Audit logging payment events (`paymentAudit` → `auth_audit_logs`) sudah ada sejak Phase 1.3.

### Fase UX (Kafe/Warung) — "Warung Kapur" (A–J)

Target segmen F&B (kafe/warung) dengan alur pelanggan order lewat QR meja. Sumber detail: `plan/PLAN_PERBAIKAN_UIUX.md` (audit + rincian endpoint/schema/test). Ringkasan dan koreksi status di bawah.

**Keputusan desain kunci Fase UX (D1–D7):**
- **D1 Segmen** = F&B (kafe/warung) → model data `menu_items` (bukan fashion/retail).
- **D2 Katalog** = `menu_items` terpisah dari `inventory`; tautan opsional via `sku` + flag `track_stock`.
- **D3 Stok** = dipotong saat kasir **menerima** pesanan (`baru → diterima`), bukan saat pelanggan kirim — spam/pesanan ditolak tidak menggerus stok.
- **D4 Laporan** = pesanan QR yang belum lunas **tidak** masuk laporan/dashboard (hanya `status='completed'` + `payment_status='paid'`).
- **D5 Login** = PIN per staff (argon2, lockout 5×/5 menit); admin tetap email + password.
- **D6 Foto menu** = data-URL kecil (WebP hasil resize klien) di `menu_items.image_url`, tanpa endpoint upload terpisah. `ponytail:` ganti ke adapter S3/local-disk saat Fase 4.1 (AWS) jalan — cukup ubah satu fungsi simpan.
- **D7 Frontend** = PWA Vite + React (sudah ada di `frontend/`, React 19 + TS + react-router 7 + `qrcode`); storage hanya untuk sesi & tema.

| Fase | Status | Ringkasan implementasi aktual / rencana |
|------|--------|--------------------------------------|
| **A. Hardening sisa** | ✅ | CI `.github/workflows/test.yml` (Postgres service + `npm test`), migration runner `npm run migrate` (`migrations/*.sql` urut + tabel `schema_migrations`), error handler diekstrak dari `src/app.js` → `src/utils/api-error.js` + `src/middleware/error-handler.js`, `paginationSchema` Zod terpusat (sekarang limit/offset duplikat per schema), README diperbarui. Test: `tests/ux-0-hardening.test.js` (11 test). (Rate limit, CORS allowlist, helmet, body limit, request-id, metrics **sudah ✅** di 4.2–4.3.) |
| **B. Katalog menu, kategori, meja** | ✅ | Migrasi **`014_catalog.sql`** + timestamp katalog diselaraskan di `015_orders.sql`: `categories`, `menu_items` (harga rupiah bulat), `dining_tables` (token acak). RLS enable+force, GRANT `pos_app`. Lookup token via `SECURITY DEFINER`. CRUD admin `/categories`, `/menu-items`, `/tables`. `/pos/menu` untuk kasir. Test: `tests/ux-1-catalog.test.js`. |
| **C. Model pesanan + kalkulasi server** | ✅ | `015_orders.sql` telah diterapkan; snapshot source/meja/fulfillment/diskon/pajak, harga dari katalog, pembulatan rupiah, counter harian atomik, QR draft/unpaid dikecualikan dari laporan. Test `ux-2-orders.test.js` dan regresi dashboard lulus. |
| **D. API publik pelanggan (QR)** | ✅ | Tanpa JWT, tenant dari token meja terverifikasi. `GET /public/tables/:token/menu`, `POST /public/tables/:token/orders` (wajib `Idempotency-Key` → replay 200), `GET /public/orders/:id?pt=<public_token>`. Zod strict: maks 30 item, qty 1–20, `note` ≤60, `customer_name` ≤24, `payment_pref` (kasir|qris). Rate limit per IP + token meja (`RATE_LIMIT_PUBLIC_MAX`, default 10/menit). Menu `is_available=false` → 409 (via validasi pesanan). Tidak ada endpoint list; respons tidak bocorkan `merchant_id`/data staff. Lookup order via fungsi `SECURITY DEFINER` `lookup_order_by_public_token` (migrasi `016_public_orders.sql`). Test: `tests/ux-3-public.test.js`. |
| **E. Alur kasir: status, bayar manual, realtime** | ✅ | State machine `fulfillment_status` (transisi di luar aturan → 409; `selesai` hanya bila `payment_status='paid'`). `GET /pos/orders` (filter chip), `PATCH /pos/orders/:id/status` (+`reject_reason`), `POST /pos/orders/:id/pay` (tunai/kartu/qris; hitung kembalian server, 409 bila kurang), `GET /pos/orders/stream` (SSE; fallback polling `?since=`). Stok dipotong saat `baru → diterima` (pakai `FOR UPDATE` yang sudah ada di `inventory.service.js`), dikembalikan bila batal. `qris` masuk CHECK `payment_method` (`017_phase_e_payment_method_qris.sql`); provider `manual` untuk mode kasir. Order QR dibuat lewat `POST /pos/transactions` (source `qr`, `payment_status='unpaid'`), bukan endpoint `/orders` terpisah. |
| **F. Login PIN + device pairing** | ⬜ | `staff.pin_hash` (argon2), `pin_failed_count`, `pin_locked_until`; `merchants.code` (mis. `warung-kapur`). Pairing sekali: admin (email+password) buat kode → tablet simpan device token. `POST /auth/pin-login` → access+refresh. PIN 4–6 digit, lockout 5×/5 menit, rate limit, audit ke `auth_audit_logs`, PIN tidak pernah di-log. |
| **G. Pengaturan toko, struk, laporan** | ⬜ | `merchant_settings` (1 baris/merchant): `store_name`, `tax_pct`, `discount_presets`, `payment_mode` (manual|gateway), `qris_static_url`. `GET/PATCH /admin/settings`, `GET /pos/settings` (read-only kasir). Struk: label Indonesia, "Makan di sini, meja N"/"Bawa pulang", "Dipesan lewat QR", waktu Asia/Jakarta `dd/MM/yyyy, HH.mm`, hapus `receipt_url` palsu (isi hanya bila env `RECEIPT_BASE_URL` ada). Laporan: `GET /pos/reports/range` (+`.csv` UTF-8 BOM), `GET /pos/reports/series?days=`; validasi `from ≤ to`, rentang maks 366 hari. |
| **H. Foto menu (opsional)** | ⬜ | Berubah jadi opsional karena D6: simpan WebP data-URL (resize di klien) via `PATCH /admin/menu-items/:id/image` — tanpa `multer`/`sharp` baru. Naikkan ke upload file+S3 hanya saat 4.1 jalan. Placeholder ikon kategori dipakai bila foto kosong. |
| **I. Integrasi Frontend ↔ API** | ⬜ | **Dipangkas** — semua layar + CSS design system sudah ✅ (lihat PROGRESS "Frontend UI Alignment"); `frontend/` sudah Vite+React19+TS. Sisa: ganti sumber data `localStorage`+seed → API, tambah loading/error state, offline queue IndexedDB untuk pesanan kasir (pakai `Idempotency-Key`), ganti `BroadcastChannel` → SSE + polling fallback, pesan error ramah pelanggan, cetak struk dari `GET /pos/transactions/:id/receipt`. |
| **J. QA e2e + rilis** | ⬜ | Skenario penuh (scan → pesan → terima → proses → siap → bayar tunai → selesai → muncul di laporan/struk), penolakan pesanan beralasan, uji rate limit & isolasi tenant endpoint publik, uji tablet landscape/HP portrait/tema gelap-terang, uji offline tanpa duplikat, review keamanan (token meja, `public_token`, lockout PIN, CORS), update PLAN.md + README. |

**Konvensi Fase UX**: Route → Controller → Service → Repository → PostgreSQL; Zod per route; semua query lewat `withTenantContext`; RLS enable+force + policy `*_isolation` + GRANT `pos_app`; tenant selalu dari JWT atau token meja terverifikasi; test per fase `tests/ux-N-*.test.js` (skip bila DB 503, merchant khusus agar aman paralel); tanpa secret di kode/test; jangan log PIN/token/nomor kartu.

**Risiko utama**: perubahan semantik status merusak laporan lama (ditegakkan Fase C = kolom baru, test regresi dashboard/reports/analytics/HR komisi); endpoint publik disalahgunakan (rate limit per IP+meja, token panjang & rotatable, stok tidak dipotong sampai diterima); float pada uang (integer rupiah + satu fungsi kalkulasi); realtime tak stabil di jaringan warung (fallback polling + indikator koneksi).

### Testing (5.1) — ringkas
Unit 80% coverage, integration 60%, e2e key flows. Fokus: validasi amount, negative test, sync inventory setelah payment, isolasi tenant.

### Performance (6.1–6.2) — ringkas
- **Index**: `transactions(merchant_id, transaction_date DESC)`, `(payment_status)`, `(location_id, transaction_date DESC)`, `inventory(merchant_id, sku)`; partition bulanan (future).
- **Cache Redis**: session 24h, merchant config 1h, inventory 5m (invalidate on write), dashboard 30m.

---

## 4. Standar & Konvensi Development

### Pola codebase
```
Route → Controller → Service → Repository → PostgreSQL
```
- Struktur: `src/routes/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/middleware/`, `src/schemas/`, `src/payments/` (adapters), `src/config/`, `src/utils/`. Middleware hardening: `rate-limit.js`, `request-id.js`, `metrics.js`. Config: `cache.js` (Redis/in-memory).
- **Tenant context**: semua query data wajib lewat `withTenantContext(pool, merchantId, callback)` — `BEGIN` → `set_config('app.merchant_id', $1, true)` → callback → `COMMIT`/`ROLLBACK`; param ketiga `true` = hanya berlaku selama transaksi (penting untuk pg pool).
- **Validasi**: Zod schema per route (`src/schemas/*.schema.js`).
- **Error handling**: kelas error kustom (`utils/api-error.js`) + `error-handler.js` middleware; webhook invalid signature → 401/403.
- **Security**: tenant dari JWT saja — header `X-Tenant-ID` hanya validasi (harus sama dengan JWT). Jangan log secret/key/nomor kartu. Role `pos_app` tanpa BYPASSRLS.

### Test conventions
- Framework bawaan Node: `node --test tests/` (+ supertest untuk HTTP).
- File: `tests/phase-1-X.test.js` per phase.
- **Skip kalau DB 503**: test mengecek koneksi DB; jika tidak tersedia, skip (bukan fail) agar CI lokal tanpa DB tetap hijau.
- Seed dev (via `npm run seed-dev`):
  - merchant: `123e4567-e89b-12d3-a456-426614174000`
  - staff admin: `00000000-0000-0000-0000-000000000001`
  - email: `admin@dev.local` / password: `devpassword123`
- Payment: `PAYMENT_MODE=dummy` untuk dev/test (adapter dummy, tanpa panggilan eksternal). Webhook secret dev: `dummy-development-secret`.
- Provisioning merchant awal: script terpisah `npm run provision-merchant` (bukan endpoint aplikasi biasa) karena RLS mengharuskan `app.merchant_id` ter-set.

### Migrasi database
- File SQL urut `migrations/001_*.sql` … `008_*.sql` di root repo:
  1. `001_auth_multitenancy.sql` — merchants, staff, RLS
  2. `002_auth_refresh_and_audit.sql` — refresh tokens, audit log
  3. `003_pos_transactions.sql` — transactions, transaction_items
  4. `004_rls_transactions.sql` — RLS transaksi
  5. `005_api_keys.sql` — api_keys
  6. `006_payments.sql` — payments, payment_webhook_events, kolom payment di transactions
  7. `007_inventory.sql` — inventory, inventory_movements
  8. `008_transaction_idempotency.sql` — kolom `idempotency_key` di transactions + partial unique index
  9. `009_hr_staff.sql` — kolom HR di staff + shifts, timesheets, commissions
 10. `010_analytics.sql` — view `v_daily_sales` (security_invoker=true)
 11. `011_ecommerce.sql` — ecommerce_connections, ecommerce_orders, ecommerce_order_items
 12. `012_click_and_collect.sql` — click_and_collect_orders
 12b. `012b_cnc_movement_types.sql` — extend inventory_movements type (+cnc_reserve/cnc_cancel/cnc_expire)
 13. `013_accounting.sql` — accounting_connections, journal_entries, journal_lines, tax_invoices
  14. `014_catalog.sql` — categories, menu_items, dining_tables
  15. `015_orders.sql` — timestamps katalog, kolom fulfillment/pesanan, order_counters, filter laporan lunas
  16. `016_public_orders.sql` — `lookup_order_by_public_token(VARCHAR, VARCHAR)` SECURITY DEFINER (status pesanan QR tanpa JWT)
  17. `017_phase_e_payment_method_qris.sql` — tambah `qris` ke CHECK `payment_method` transaksi
- Dijalankan dengan **psql postgres superuser**: `psql -d pos_hybrid -f migrations/00X_*.sql` (butuh superuser untuk CREATE ROLE/extension; app connect sebagai `pos_app`).

### Environment variables utama
```env
DATABASE_URL=postgresql://pos_app:...@localhost:5432/pos_hybrid
JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (access 15m, refresh 24h)
PAYMENT_MODE=dummy | stripe | xendit
PAYMENT_WEBHOOK_TOLERANCE_SECONDS=300
STRIPE_ENABLED / STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
XENDIT_ENABLED / XENDIT_SECRET_KEY / XENDIT_WEBHOOK_TOKEN
QRIS_ENABLED / QRIS_PROVIDER=xendit
# Hardening (Phase 4.2–4.3)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=10
CORS_ORIGINS=            # comma-separated; kosong = allow all (dev only)
TRUST_PROXY=1
REDIS_URL=               # opsional; kosong = in-memory cache
CACHE_DEFAULT_TTL_SECONDS=300
INVENTORY_CACHE_TTL_SECONDS=300
```
Provider disabled → error terkontrol, bukan request eksternal.

### Definition of Done (per phase)
Semua test lulus (`npm test`), RLS terbukti (tenant A tidak baca data tenant B), tidak ada secret production di test/code, audit trail ada, dokumentasi plan di-update.

---

## 5. PROGRESS (per phase — saat ini)

| Phase | Status | Keterangan |
|-------|--------|------------|
| 1.1 Auth & Multi-Tenancy | ✅ | JWT login/refresh/logout, RBAC, API keys, RLS merchants/staff, tenant context, audit login, dev seed |
| 1.2 Transaksi POS | ✅ | CRUD transaksi + items, tabel transactions/transaction_items, RLS, atomic stock deduction |
| 1.3 Payment Gateway | ✅ | Adapter Stripe/Xendit/QRIS/Dummy, create/get/cancel/refund, webhook completion (signature + dedup + atomic update), reconcile + retry admin |
| 1.4 Receipt Printing | ✅ | `GET /pos/transactions/:id/receipt` — format `text`/`escpos`/`json` via query param |
| 1.5 Offline/Idempotency | ✅ | Idempotency-Key (header/body) → replay 200 tanpa duplikat, kolom `idempotency_key` + unique index (migrasi 008), race 23505 ditangkap; offline queue IndexedDB menunggu frontend PWA |
| 1.6 Inventory | ✅ | Tabel inventory + movements, anti-oversell atomic, admin CRUD + adjust + movements, `GET /pos/inventory/availability` |
| 1.7 Dashboard & Reporting | ✅ | Dashboard today + reports daily/weekly/monthly, timezone Asia/Jakarta, isolasi RLS teruji |
| 2.1 Advanced Analytics | ✅ | View `v_daily_sales` (security_invoker), 4 endpoint admin (sales-by-product, margin, slow-moving, turnover), migrasi 010, 8 test — **tanpa matview+refresh (view live, RLS berlaku otomatis)** |
| 2.2 HR & Staff | ✅ | Shift CRUD + overlap check, clock in/out auto-link shift, staff performance dari transaksi, komisi MVP idempotent (rate per staff), migrasi 009, 14 test |
| Phase 2 (2.1 Analytics + 2.2 HR) | ✅ | Kedua sub-phase selesai |
| 3.1 E-Commerce Connector | ✅ | Tabel connections/orders/order_items (migrasi 011), adapter pattern (dummy aktif, tokopedia/shopee/woocommerce placeholder), CRUD connections, sync orders, push inventory, fulfill + tracking, 19 test — RLS cross-merchant teruji |
| 3.2 Click & Collect | ✅ | Reserve hold stok (cnc_reserve), pickup_code unik, verify by code, cancel/expire restock, migrasi 012+012b, 13 test |
| 3.3 Accounting | ✅ | Journal harian balance (DR=CR), GL mapping 1000/2100/4100/5100/1300, tax invoice PPN 11%, issue faktur_pajak_number, dummy provider sync, migrasi 013, 18 test |
| Phase 3 (3.1 + 3.2 + 3.3) | ✅ | Semua sub-phase selesai |
| Phase 4.2 Monitoring & Rate Limiting | ✅ | Rate limit in-memory (global 100 req/menit, /auth 10 req/menit, skip di test), `X-Request-Id` tracing, metrics middleware + `GET /metrics` (counters HTTP/payment/webhook, latency p50/p95/p99 per route, status buckets, payment_success_rate), pino-http dengan request id |
| Phase 4.3 Security & Cache | ✅ | CORS allowlist via `CORS_ORIGINS` (comma-separated; kosong = allow all dev-only), helmet hardening (CSP off untuk JSON API), trust proxy (`TRUST_PROXY`), express.json limit 1mb, cache layer (`config/cache.js`) — Redis opsional via `REDIS_URL` dengan fallback in-memory TTL; inventory availability di-cache per-SKU + invalidasi saat stok berubah (sale/adjust/return), audit logging payment events sudah ada dari Phase 1.3 |
| Phase 4 (4.2 + 4.3) | ✅ | Kedua sub-phase selesai — 162/162 test hijau (termasuk `phase-4-hardening.test.js` 17 test) |
| Phase 4.1 Cloud Deployment | ⬜ | AWS + Terraform + CI/CD — butuh akun AWS |
| Frontend UI Alignment (vs prototype referensi) | ✅ | CSS design system disamakan dengan `"Warung Kapur, prototype kasir, admin, dan pelanggan QR.html"`: `tokens.css` (glow/overlay vars), `chalk.css` (font 18px/1.35, chalk dust body::before/after z-80, .box::before frame, .btn system + fill/on), `layout.css` full port (frame kasir 12px solid / admin 14px double / cust 6px; shell/side/hdr/kasir/ticket/grid/card/qty/olist/ocard/tbl/stats4/twocol/panel/chart/rank/tgrid/tcard/overlay/dialog/toast/login roles+pinpanel/cust chdr+cchips+clist+mrow+cbar+sheet+track). Shell.tsx restructure ke `.frame > .shell > .side + .main > .hdr + .page > .content`. Header.tsx (ptitle grain, clock, stamp box dbl, theme/photo toggle). Button.tsx (variant+radius+active→btn fill/small/link box r2/r3 on). KasirPage→kasir grid + toolbar search + mbar mobile. OrderPanel→ticket/t-head/items/line/sum/total. MenuGrid→grid/card/qty/nm/pr. KasirSidebar/AdminSidebar→side/sbrand/snav/navi/bdg/sscroll/stitle/ts/sfoot. IncomingOrders→olist/ocard/ofoot/oact + StatusChip/PaymentChip. Riwayat→sumrow+tbl. PayModal→methods/due/recv/quick/keys/change/qrbox. Receipt→overlay/dialog/slip. Login→loginwrap/roles/rolecard/pinpanel/dots/keys. CustomerMenu→frame cust/chdr/cwrap/cchips/clist/mrow/cbar. CartSheet→sheetwrap/sheet/cline/noteinp/paypref. OrderStatus→ostat/track/dot. Admin pages→stats4/twocol/panel/chart/rank, pagehead/tbl, catrow/addrow, tgrid/tcard, sumrow+chips. print.css: @page A6, .pcard, .receipt-print 80mm. index.html: hatch pattern + grain seed params. Build bersih (tsc+vite, 96 modules, ~357 kB). |
| Fase UX A (Hardening sisa) | ✅ | CI `.github/workflows/test.yml`, `npm run migrate`, ekstrak error handler, `paginationSchema` Zod terpusat, sinkron PLAN.md, 11 test (`ux-0-hardening.test.js`). |
| Fase UX B (Katalog menu/kategori/meja) | ✅ | `014_catalog.sql` + timestamp katalog di `015_orders.sql`, CRUD admin + `/pos/menu`, lookup token meja via `SECURITY DEFINER`. 10 test `ux-1-catalog.test.js` lulus. |
| Fase UX C (Model pesanan + kalkulasi server) | ✅ | `015_orders.sql`, snapshot pesanan/fulfillment, harga dari katalog, pembulatan rupiah, nomor harian atomik, QR draft unpaid dikecualikan dari laporan. 6 test UX-2 dan 9 test regresi laporan lulus. |
| Fase UX D (API publik pelanggan QR) | ✅ | `/public/tables/:token/*`, `/public/orders/:id?pt=`, rate limit IP+meja, Idempotency wajib, `016_public_orders.sql`. 5 test `ux-3-public.test.js` lulus; suite penuh **194/194** (termasuk perbaikan ekspektasi test phase-1-1/1-6/1-5 terhadap payment_status lunas + race tenant paralel). |
| Fase UX E (Alur kasir: status/bayar/realtime) | ✅ | State machine dapur, `GET /pos/orders` (filter), `PATCH /pos/orders/:id/status`, `POST /pos/orders/:id/pay` manual, SSE + polling fallback `?since=`, `017_phase_e_payment_method_qris.sql` (tambah `qris`). 12 test `phase-e-orders.test.js` lulus; suite penuh **206/206**. |
| Fase UX F (Login PIN + device pairing) | ⬜ | `staff.pin_hash` (argon2), lockout, `merchants.code`, `/auth/pin-login` |
| Fase UX G (Pengaturan toko/struk/laporan) | ⬜ | `merchant_settings`, struk Indonesia + Asia/Jakarta, `reports/range(.csv)` |
| Fase UX H (Foto menu — opsional) | ⬜ | Data-URL WebP di `image_url` (tanpa upload endpoint baru); S3 saat 4.1 jalan |
| Fase UX I (Integrasi Frontend ↔ API) | ⬜ | Ganti localStorage → API, loading/error, offline queue, SSE, layar sudah ✅ |
| Fase UX J (QA e2e + rilis) | ⬜ | Skenario penuh, rate limit, perangkat/tema, offline tanpa duplikat, review keamanan |

**Catatan status**: backend-only (Express 5 + PostgreSQL RLS), frontend PWA "Warung Kapur" (Tahap 1–5 + UI Alignment vs prototype referensi) selesai sebagai prototype standalone localStorage. **Backend Phase 1–3 100%, Phase 4.2–4.3 (hardening) 100%, Frontend UI Alignment 100%.** Test hijau semua: **206/206** (`phase-1-1`, `phase-1-4`, `phase-1-5`, `phase-1-6`, `phase-1-7`, `phase-2-1`, `phase-2-2`, `phase-3-1`, `phase-3-2`, `phase-3-3`, `phase-4-hardening.test.js`, `ux-0-hardening.test.js`, `ux-1-catalog.test.js`, `ux-2-orders.test.js`, `ux-3-public.test.js`, `phase-e-orders.test.js`).

---

## 6. RENCANA BERIKUTNYA

### Status: Backend Phase 1–4.3 SELESAI (162/162 test hijau) + Frontend PWA (UI Alignment) SELESAI + Fase UX A–E SELESAI (206/206 test hijau)

Backend POS Hybrid sudah fungsional penuh + hardened (Phase 1–4.3) + katalog/pesanan/QR/kasir (Fase UX A–E). Frontend PWA `frontend/` (Vite + React 19) sudah selesai UI + CSS design system vs prototype; sisa hubungkan ke backend (Fase I).

Berikutnya: **Fase UX (kafe/warung)** — urutan yang disetujui:
**A (sisa hardening) → B (katalog) → C (model pesanan) → D+E paralel (API publik + alur kasir) → I (frontend↔API) → F (PIN) → G (settings/struk/laporan) → J (QA)**, sedangkan **H (foto) bersifat opsional/fleksibel**.

**Status eksekusi**: A ✅, B ✅, C ✅, D ✅, **E ✅ (selesai — 206/206 test hijau)**. Berikutnya: **Fase I (integrasi frontend↔API)** — ganti `localStorage` → API, loading/error, offline queue, SSE. Sisa setelah I: **F (PIN) → G (settings/struk/laporan) → J (QA)**; **H (foto)** opsional.

| No | Fase | Prioritas | Rencana singkat |
|----|------|-----------|-----------------|
| 1 | **A. Hardening sisa** | P0 | CI `.github/workflows/test.yml` (Postgres + `npm test`), migration runner `npm run migrate` + `schema_migrations`, error handler → `src/utils/api-error.js` + `src/middleware/error-handler.js`, `paginationSchema` Zod terpusat, README. (Rate limit/CORS/helmet sudah ✅) |
| 2 | **B. Katalog menu/kategori/meja** | P0 | `014_catalog.sql`, CRUD `/admin/categories` (+reorder), CRUD `/admin/menu-items`, `/pos/menu`, `/admin/tables` + regenerate-token, lookup token via SECURITY DEFINER |
| 3 | **C. Model pesanan + kalkulasi server** | P0 | `015_orders.sql` (`fulfillment_status`, `source/order_type/table_id/daily_number/discount_pct/tax_pct/public_token`, `order_counters`), price-from-server, kalkulasi integer rupiah, test regresi dashboard/reports/analytics/HR |
| 4 | **D. API publik pelanggan (QR)** | P0 | ✅ `/public/tables/:token/menu`, `POST /public/tables/:token/orders` (Idempotency wajib), `/public/orders/:id?pt=`, rate limit IP+meja, menu habis → 409 |
| 5 | **E. Alur kasir** | P0 | ✅ State machine dapur `PATCH /status`, `POST /pay` (tunai/kartu/QRIS manual), SSE + polling fallback, stok dipotong saat diterima |
| — | **B // C** | — | Urut: B dulu, lalu C. |
| 6 | **I. Integrasi frontend↔API** | P1 | Ganti `localStorage`+seed → API, loading/error, offline queue IndexedDB, SSE; layar sudah ada |
| 7 | **F. Login PIN + device pairing** | P1 | `staff.pin_hash`, lockout, `/auth/pin-login` |
| 8 | **G. Settings/struk/laporan** | P1 | `merchant_settings`, struk Indonesia/Asia-Jakarta, `/pos/reports/range(.csv)` |
| 9 | **J. QA e2e + rilis** | P1 | Scenario penuh, rate limit, device/tema, offline, review keamanan, update PLAN/README |
| 10 | **H. Foto menu** | P2 | Opsional sesaat; data-URL WebP di `image_url`. Naikkan ke S3 saat Fase 4.1 jalan |

**Paralel yang aman:** Fase F dan H fleksibel — bisa paralel dengan fase lain bila sumber daya ada. Fase I (frontend) dapat dimulai begitu endpoint B/C/D/E mencukupi.

### Aturan update dokumentasi
- Setiap selesai 1 phase: perbarui tabel **PROGRESS** (bagian 5) + ringkasan di bagian 3 + tulis rencana phase berikutnya di **bagian 6** (pindahkan rencana yang sudah dieksekusi ke ringkasan aktual dan hapus dari "berikutnya").
- Jangan membuat file plan baru; dokumen ini living document — ringkasan Fase UX ada di `plan/PLAN_PERBAIKAN_UIUX.md` (referensi rinci).

---

## 7. Tools & Templates Ringkas

### Checklist implementasi per phase (ringkas)
- [ ] Tentukan scope endpoint + tabel + migrasi urut
- [ ] Buat migration SQL (RLS enabled+forced, grants, index, unique constraint)
- [ ] Repository → Service → Controller → Route (ikuti pola yang ada)
- [ ] Zod schema validasi input
- [ ] Tenant isolation via withTenantContext (bukan parameter bebas)
- [ ] Unit + integration test (`node --test tests/phase-1-X.test.js`), skip kalau DB 503
- [ ] Jalankan semua test hijau sebelum tandai selesai
- [ ] Update PROGRESS + RENCANA BERIKUTNYA di PLAN.md ini

### Template laporan (business, untuk tim sales/founders)
- **Weekly Business Review**: acquisition (leads, demo, trial→paid, CAC), retention (churn <5%, NPS ≥50, tiket support), revenue (MRR, growth 15–20%), wins, blockers, prioritas minggu depan.
- **Monthly Business Plan**: pipeline, top 3 deal, churn analysis, expansion MRR, release produk, feedback merchant top-5, financials vs budget, hiring.
- **Competitive Loss Report**: alasan kalah (rank 1–3), apa yang mereka suka dari kita, intel kompetitor, perbaikan.
- **Customer Onboarding (4 minggu)**: setup akun+gateway → integrasi marketplace → training (manager 2 jam, cashier 1 jam) → go-live + parallel run 3 hari + NPS 30 hari.

### KPI / metrics yang dilacak
- **Produk**: uptime 99,95%, latency transaksi <100ms, 2 rilis/bulan, success rate payment gateway.
- **Merchant**: 1K (Y1) → 10K (Y2) → 50K (Y3); churn <5%/bln; NPS ≥50; demo→paid ≥60%.
- **Finansial**: MRR growth 15–20%, gross margin ≥85%, CAC Rp8M & payback <7 bulan, LTV:CAC ≥4,5:1, burn ±10% vs budget.
- **Funnel bulanan (Y1)**: 1.000 leads → 500 demo → 350 trial → 210 paid/bulan pada bulan ke-12.

### Decision framework (ringkas)
- **Hire?** butuh ≥5/6: pengalaman relevan, track record, cultural fit, growth mindset, references kuat, mau equity+salary.
- **Masuk segmen?** skor ≥20/30: TAM, growth, willingness to pay, competition, diferensiasi, market share realistis.
- **Build fitur?** skor ≥15/25: permintaan merchant, dampak churn, dampak revenue, effort, competitive advantage (+5 jika kompetitor sudah punya).

---

**Dokumen ini living document** — update setiap phase selesai. Owner: Founder/Product. Review: per phase atau quarterly.
