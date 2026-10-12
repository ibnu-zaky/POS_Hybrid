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

Stack: **Node.js 20+ / Express 5 / PostgreSQL (RLS multi-tenant)** — backend-only saat ini (frontend PWA belum ada).
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
- **2.1 Advanced Analytics** (⬜): sales per produk, margin (pakai `inventory.unit_cost`), turnover estimasi, slow-moving SKUs — pendekatan DB-native (materialized view), warehouse eksternal (BigQuery) ditunda.
- **2.2 HR/Staff** ✅: migrasi `009_hr_staff.sql` — kolom HR di `staff` (hire_date, employment_type, hourly_rate, monthly_salary, commission_rate) + tabel `shifts` (UNIQUE per staff/hari, cek overlap), `timesheets` (satu clock-in terbuka per staff via unique partial index), `commissions` (UNIQUE per staff/hari → upsert idempotent). Endpoints: CRUD `/admin/hr/shifts`, `GET /admin/hr/timesheets`, `GET /admin/hr/staff-performance?from=&to=` (agregat transaksi per cashier), `PATCH /admin/hr/staff/:id` (field HR), `POST /admin/hr/commissions/calculate?date=`, `GET /admin/hr/commissions`, `PATCH /admin/hr/commissions/:id` (paid); clock `/pos/hr/clock-in|clock-out` (admin/manager/cashier, auto-link shift hari ini). Files: `hr.schema/repository/service/controller.js`, `tests/phase-2-2.test.js` (14 test, merchant khusus).

### Phase 3: Omnichannel & Ecosystem (Month 13–18) — ringkas
- **3.1 E-Commerce**: connector Tokopedia/Shopee/WooCommerce — pull orders (polling 5 menit + webhook), inventory sync real-time, auto-confirm + fulfillment status.
- **3.2 Click & Collect**: order online → reserve inventory 24 jam → pickup QR verification. Tabel `click_and_collect_orders`.
- **3.3 Accounting**: sync harian ke Xero/MYOB/QuickBooks; GL mapping (sales 4100, COGS 5100, tax 2100, cash 1000, dsb.); e-Faktur PPN.

### Infrastructure & Deployment (4.1–4.3) — ringkas
- **4.1 Cloud**: AWS — CloudFront → ALB → ECS (API/Web) + RDS PostgreSQL + ElastiCache Redis + S3 (receipts) + SQS (jobs) + SNS. IaC Terraform; CI/CD GitHub Actions (test per PR, staging auto, prod manual approval, blue-green).
- **4.2 Monitoring**: p50/p95/p99 latency, error rate, query time, payment success rate. Alert: latency >500ms warning; error >1% critical; gateway down → page.
- **4.3 Security**: PCI-DSS readiness (TLS 1.3, tokenisasi via gateway, no card storage), rate limiting 100 req/menit, helmet, CORS allowlist, audit logging, data residency Indonesia.

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
- Struktur: `src/routes/`, `src/controllers/`, `src/services/`, `src/repositories/`, `src/middleware/`, `src/schemas/`, `src/payments/` (adapters), `src/config/`, `src/utils/`.
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
| 2.1 Advanced Analytics | ⬜ | Belum — lihat bagian 6 |
| 2.2 HR & Staff | ✅ | Shift CRUD + overlap check, clock in/out auto-link shift, staff performance dari transaksi, komisi MVP idempotent (rate per staff), migrasi 009, 14 test |
| Phase 2 (sisa: 2.1 Analytics) | ⬜ | Belum |
| Phase 3 (Omnichannel & Accounting) | ⬜ | Belum |

**Catatan status**: backend-only (Express 5 + PostgreSQL RLS), belum ada frontend/PWA. **Phase 1 (1.1–1.7) 100% selesai. Phase 2.2 selesai.** Test hijau semua: 87/87 (`tests/phase-1-1`, `phase-1-4`, `phase-1-5`, `phase-1-6`, `phase-1-7`, `phase-2-2.test.js`).

---

## 6. RENCANA BERIKUTNYA

### Fase selanjutnya: Phase 2.1 Advanced Analytics (tanpa warehouse eksternal — pendekatan DB-native)

**Keputusan desain**:
- **Tanpa BigQuery/Snowflake dulu** — semua agregat dilakukan di PostgreSQL (sudah cukup untuk skala MVP; warehouse eksternal ditunda sampai ada kebutuhan nyata)
- **Materialized view** `mv_daily_sales` (merchant_id, day, product_name/sku, quantity, revenue, unit_cost_est) sebagai pre-aggregate cepat; refresh manual via endpoint admin (cron menyusul)
- **Margin**: `transactions_items.line_total - quantity * COALESCE(inventory.unit_cost, 0)` — inventory.unit_cost sudah ada (nullable → margin pakai null-safe, tandai `has_cost`)
- **Slow-moving**: SKU di inventory tanpa penjualan N hari (default 30)
- **Turnover ratio**: COGS période / average stock — MVP: approximasi dari quantity terjual vs rata-rata quantity (snapshot stok saat ini; historical stock belum ada → tandai estimasi)

**Langkah implementasi:**
1. Migrasi `010_analytics.sql`:
   - `CREATE MATERIALIZED VIEW mv_daily_sales AS` agregat per merchant×day×sku dari transactions+items (hanya status completed)
   - unique index `(merchant_id, day, sku)` di view untuk REFRESH CONCURRENTLY
   - (opsional nanti) tabel `analytics_snapshots` untuk historikal turnover
2. Endpoints (admin):
   - `POST /admin/analytics/refresh` — REFRESH MATERIALIZED VIEW CONCURRENTLY
   - `GET /admin/analytics/sales-by-product?from=&to=&limit=` — dari mv_daily_sales
   - `GET /admin/analytics/margin?from=&to=&limit=` — revenue, est. COGS, est. margin % per produk
   - `GET /admin/analytics/slow-moving?days=30` — inventory tanpa penjualan N hari
   - `GET /admin/analytics/turnover?from=&to=` — ratio estimasi per produk
3. Files: `analytics.repository.js`, `analytics.service.js`, `analytics.schema.js`, `analytics.controller.js`, routes di `admin.routes.js`, `tests/phase-2-1.test.js` (merchant khusus + seed transaksi + assert angka margin/slow-moving)
4. DoD 2.1: semua laporan akurat vs data mentah, refresh view jalan, RLS teruji (view pakai `WHERE merchant_id` + security_invoker bila memungkinkan — cek PG16 support), `npm test` hijau, update PLAN.md

### Setelah itu: Phase 3 (ringkas)
1. **3.1 E-Commerce**: connector Tokopedia/Shopee/WooCommerce — pull orders (polling + webhook), inventory sync real-time
2. **3.2 Click & Collect**: order online → reserve inventory 24 jam → pickup QR
3. **3.3 Accounting**: sync harian Xero/MYOB/QuickBooks, GL mapping, e-Faktur PPN

### Backlog frontend (di luar backend phases)
- PWA kasir (offline queue IndexedDB — pelengkap client dari idempotency 1.5), print receipt dari browser (pakai endpoint escpos/text), dashboard UI, HR UI (shift, clock, komisi)

### Aturan update dokumentasi
- Setiap selesai 1 phase: perbarui tabel **PROGRESS** (bagian 5) + ringkasan implementasi di bagian 3 + tulis rencana phase berikutnya di **bagian 6** (pindahkan rencana yang sudah dieksekusi ke ringkasan implementasi aktual di bagian 3 / hapus dari "berikutnya").
- Jangan membuat file plan baru; dokumen ini living document.

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
