# Plan: Retrofit Fase 0 → Selisih Fase 1

Sumber: `plan/ROADMAP.md`
Desain: `docs/superpowers/specs/2026-11-06-roadmap-fase0-fase1-design.md`
Branch: `retrofit/fase0-fase1`
Metode: subagent-driven development (satu implementer per task, review per task)

## Global Constraints

- Bahasa dokumen dan komentar: Indonesia. Gaya kode mengikuti file sekitarnya.
- Backend CommonJS. Jangan menambah dependency baru; pakai yang sudah ada di
  `apps/api/package.json` / `apps/web/package.json`.
- Setiap task wajib menjaga seluruh test lama hijau. Baseline: 220 test di 17
  file (`apps/api/tests/`). Jalankan `npm test --workspace apps/api`.
- Migrasi baru bernomor 019–023, idempoten, dan memakai pola RLS repo.
- Tabel baru wajib `merchant_id` + RLS + test isolasi tenant.
- Uang di aplikasi selalu integer rupiah; batas DB `NUMERIC(12,2)`.
- Jangan commit `.env`, secret, atau artefak `.playwright-cli/`.
- Jangan mengubah perilaku endpoint publik kecuali dinyatakan di task.
- Setiap task diakhiri dengan commit kecil yang menyebut task.

## Task 1: Baseline bersih

**Tujuan:** titik awal yang bisa direproduksi sebelum restrukturisasi.

**Files:**
- `.gitignore`
- `plan/prototype-warung-kapur.html`
- `README.md`, `backend/src/controllers/auth.controller.js`,
  `backend/src/scripts/migrate.js` (perubahan yang sudah ada di working tree)

**Steps:**
1. Restore `Warung Kapur, prototype kasir, admin, dan pelanggan QR.html` lalu
   pindahkan ke `plan/prototype-warung-kapur.html`.
2. Hapus file artefak root `ole.log(\`stripe_enabled=${env.STRIPE_ENABLED}\`);`
   dari Git dan disk.
3. Tambahkan `.playwright-cli/` dan `.worktrees/` ke `.gitignore`.
4. Pertahankan perbaikan yang sudah ada di working tree: quick start `README`,
   fallback `request.db ?? pool` di `auth.controller.js`, dan path migrasi
   `../../..` di `migrate.js`.
5. Commit baseline.
6. Catat hasil `npm test --workspace apps/api` (harus 220 lulus, 0 gagal).

**Verification:** `npm test --workspace apps/api` → `# pass 220`, `# fail 0`.

## Task 2: Restrukturisasi monorepo

**Tujuan:** struktur `apps/` + `packages/` sesuai ROADMAP tanpa mengubah perilaku.

**Files:**
- `package.json` (root, npm workspaces)
- `apps/api/` (dari `backend/`)
- `apps/web/` (dari `frontend/`)
- `apps/api/src/scripts/migrate.js` (path `migrations/`)
- `.github/workflows/test.yml`
- `run-local.sh`

**Steps:**
1. `git mv backend apps/api`, `git mv frontend apps/web`.
2. Root `package.json`: `private: true`, `workspaces: ["apps/*", "packages/*"]`,
   script agregat `test`, `lint`, `build`.
3. Perbaiki path migrasi agar menunjuk `apps/api/../../migrations` (root
   `migrations/` tetap di tempat).
4. `.github/workflows/test.yml`: `working-directory: apps/api`, `npm ci` per
   workspace.
5. `run-local.sh` memakai path `apps/api` dan `apps/web`.
6. `backend/package.json` name menjadi `@pos/api`; `frontend` menjadi `@pos/web`.
7. Jalankan `npm install` di root untuk membuat lockfile workspaces.
8. 220 test tetap hijau.

**Verification:** `npm test` di root → 220 lulus; `bash -n run-local.sh`.

## Task 3: ADR 0001–0010

**Tujuan:** keputusan arsitektur tertulis, dirujuk skill dan docs.

**Files:** `docs/adr/0001-*.md` s/d `docs/adr/0010-*.md`, `docs/adr/README.md`.

**ADR yang wajib ada:**
1. 0001 Retrofit bertahap, bukan greenfield.
2. 0002 Monorepo npm workspaces (`apps/api`, `apps/web`, `packages/core`).
3. 0003 TypeScript gradual + ratchet `checkJs`.
4. 0004 Uang integer rupiah, `NUMERIC(12,2)` hanya di DB.
5. 0005 Multi-tenant: `merchant_id` + RLS di semua tabel.
6. 0006 Void non-destruktif (hanya transaksi belum bayar).
7. 0007 Idempotency generik + 4 koreksi mode offline (antrian outbox, retry
   backoff, konflik versi, penomoran dari perangkat).
8. 0008 Audit append-only.
9. 0009 Snapshot harga + varian minimal.
10. 0010 Permission per-tenant (`permissions` dan `role_permissions` ber-RLS).

**Format tiap ADR:** Judul, Status, Konteks, Keputusan, Konsekuensi,
Alternatif yang ditolak.

**Verification:** `ls docs/adr` berisi 10 ADR + README; tiap file punya keempat
heading.

## Task 4: AGENTS.md + skill

**Files:**
- `AGENTS.md`
- `.agents/skills/pos-domain/SKILL.md`
- `.agents/skills/offline-sync-idempotency/SKILL.md` (pindahan dari
  `.agents/skills/files/SKILL.md`)

**Steps:**
1. `AGENTS.md`: cara jalankan test/lint/build, struktur monorepo, konvensi
   migrasi, aturan uang, aturan tenant/RLS, larangan commit secret.
2. Tulis skill `pos-domain` dari ROADMAP + ADR: domain warung (menu, varian,
   stok, transaksi, refund/void, shift, laporan), istilah, invariant.
3. Pindahkan skill offline ke path benar, hapus direktori `files/`, perbarui
   `skills-lock.json` bila perlu.

**Verification:** kedua `SKILL.md` punya frontmatter `name` + `description`;
`AGENTS.md` menyebut perintah test yang benar.

## Task 5: CI frontend + ratchet typecheck

**Files:** `.github/workflows/test.yml`, `apps/web` config, `apps/api/jsconfig.json`,
`scripts/check-typecheck-baseline.js`, baseline `scripts/typecheck-baseline.json`.

**Steps:**
1. Job `api`: test 220 + ratchet `checkJs` (baseline jumlah error ±48,
   dibaca dari file; gagal hanya bila jumlah naik).
2. Job `web`: `npm run lint` + `npm run build`.
3. Job `core`: `tsc --noEmit` strict untuk `packages/core`.
4. Ratchet juga menolak error baru di file yang sebelumnya bersih.

**Verification:** `node scripts/check-typecheck-baseline.js` exit 0 pada kondisi
sekarang; `npm run lint --workspace apps/web` dan
`npm run build --workspace apps/web` lulus.

## Task 6: Void non-destruktif

**Files:**
- `migrations/019_transaction_void.sql`
- `apps/api/src/services/transaction.service.js`
- `apps/api/src/controllers/transaction.controller.js` (bila perlu)
- `apps/api/src/repositories/transaction.repository.js`
- `apps/api/tests/phase-1-6.test.js` (pertahankan test lama) + test baru

**Steps:**
1. Migrasi 019: tambah status `voided` pada constraint transaksi; tambah nilai
   movement stok `void`; kolom `voided_at`, `void_reason` bila belum ada.
2. `voidTransaction({ merchantId, transactionId, reason })`:
   - unpaid → `UPDATE status='voided'`, tulis movement `void` yang mengembalikan
     stok tepat sekali, tanpa DELETE baris.
   - sudah `voided` → tolak/idempoten tanpa restock ganda.
   - paid/refunded → tolak `409`.
3. `DELETE /pos/transactions/:id` memanggil void, tetap `200` + efek restock
   yang sama seperti test lama `phase-1-6.test.js:205`.
4. Laporan tetap memfilter `status='completed'`.

**Verification:** test baru: unpaid→stok kembali tepat sekali; void dua kali→
tidak restock ganda; void paid→409; `# pass` naik, `# fail 0`.

## Task 7: Idempotency generik

**Files:**
- `migrations/020_idempotency_keys.sql`
- `apps/api/src/services/idempotency.service.js`
- `apps/api/src/middleware/idempotency.js` (atau integrasi di controller)
- `apps/api/src/services/transaction.service.js`
- `apps/api/tests/phase-1-5.test.js` + test baru

**Steps:**
1. Migrasi 020: tabel `idempotency_keys(merchant_id, key, request_hash,
   response_status, response_body, created_at)`, UNIQUE `(merchant_id, key)`,
   RLS + policy per merchant.
2. `computeRequestHash(req)` = `sha256(method + pathname_nyata +
   canonicalJson(payloadZod))`. `pathname_nyata` = `req.baseUrl + req.path`.
3. `claimIdempotency` memakai `INSERT ... ON CONFLICT DO NOTHING RETURNING`;
   bila tidak dapat baris, `SELECT` lalu:
   - hash sama → replay `200` + `replayed:true` + body tersimpan;
   - hash beda → `422 IDEMPOTENCY_PAYLOAD_MISMATCH`.
4. `completeIdempotency` menyimpan `response_status` + `response_body`.
5. Attempt gagal rollback, key tidak terkunci.
6. Pertahankan envelope replay test lama (`phase-1-5`).

**Verification:** test baru: dua request paralel dengan key sama hanya membuat
satu transaksi; key sama + payload beda → 422; gagal lalu retry key sama →
berhasil. `# fail 0`.

## Task 8: packages/core money

**Files:**
- `packages/core/package.json`, `packages/core/tsconfig.json`,
  `packages/core/src/money.ts`, `packages/core/src/index.ts`
- `apps/api/src/services/transaction.service.js` (re-export `computeTotals`)

**Steps:**
1. `roundHalfUp(value)`: half-away-from-zero; `Math.round(-2.5) === -2` tidak
   boleh dipakai. Implementasi: `sign * Math.floor(abs + 0.5)`.
2. `round2(value)`: 2 desimal, half-away-from-zero.
3. `toRupiah(value)`: parse nilai DB `NUMERIC` (string/number) ke integer
   rupiah, menolak NaN.
4. Pindahkan `computeTotals` ke `packages/core/src/money.ts` dengan perilaku
   identik (subtotal, diskon per item, diskon persen, pajak 11%, grand total).
5. `transaction.service.js` meng-import dari `@pos/core` dan tetap
   mengekspor `computeTotals` (test lama mengimpornya).
6. Tambah self-check/assert-based test kecil untuk pembulatan negatif.

**Verification:** `npm test --workspace apps/api` → 220 + test baru lulus;
`npx tsc --noEmit -p packages/core` lulus.

## Task 9: Audit append-only

**Files:**
- `migrations/021_audit_logs.sql`
- `apps/api/src/services/auth.service.js`
- `apps/api/src/middleware/` (konteks tenant saat login)

**Steps:**
1. Migrasi 021: rename tabel audit lama → `audit_logs`, tambah `merchant_id`
   bila belum ada, backfill dari relasi yang ada, `REVOKE UPDATE, DELETE,
   TRUNCATE` dari role aplikasi, aktifkan RLS + policy per merchant.
2. `logAuthEvent` menulis `merchant_id` sesuai konteks login.
3. Login dan logout tetap berfungsi; tabel audit tidak bisa diubah lewat API.

**Verification:** test baru: event login punya `merchant_id` benar; role
aplikasi gagal `UPDATE`/`DELETE` pada `audit_logs`; 220 tetap hijau.

## Task 10: Tes konkurensi stok

**Files:** `apps/api/tests/` (file test baru, mis. `phase-1-concurrency.test.js`).

**Steps:**
1. Kirim dua transaksi paralel yang masing-masing meminta stok terakhir.
2. Pastikan tepat satu berhasil (`201`) dan satu gagal `409`, stok akhir 0
   (bukan negatif).
3. Pastikan tidak ada movement ganda.

**Verification:** test baru deterministik lulus 10 kali berturut-turut.

## Task 11: Permission RBAC per-tenant

**Files:**
- `migrations/022_permissions.sql`
- `apps/api/src/middleware/require-permission.js`
- `apps/api/src/middleware/authorize.js`
- 26 call site di `apps/api/src/routes/**`
- `apps/api/tests/` (karakterisasi + test permission)

**Steps:**
1. Karakterisasi dulu: catat perilaku `authorize(role)` sekarang dalam test.
2. Migrasi 022: tabel `permissions` dan `role_permissions`, keduanya dengan
   `merchant_id` + RLS + UNIQUE yang tepat; seed permission default per
   merchant saat provisioning.
3. `requirePermission("resource:action")` cek via `role_permissions` dalam
   konteks tenant.
4. Konversi 26 call site `authorize([...])` ke `requirePermission` dengan
   pemetaan yang menjaga perilaku test karakterisasi.
5. Test isolasi tenant: permission merchant A tidak berlaku di merchant B.

**Verification:** seluruh test lama + karakterisasi lulus; test isolasi tenant
lulus; `grep -r "authorize(" apps/api/src/routes` tidak menyisakan allow-list
role.

## Task 12: Snapshot harga + varian

**Files:**
- `migrations/023_menu_item_variants.sql`
- `apps/api/src/services/menu-item.service.js` / repository terkait
- `apps/api/src/services/transaction.service.js`
- test baru

**Steps:**
1. Test snapshot: ubah harga menu setelah transaksi dibuat; transaksi lama dan
   laporannya tetap memakai harga saat transaksi.
2. Migrasi 023: `menu_item_variants(id, merchant_id, menu_item_id, name, sku,
   price_override, is_available)` + RLS + unique `(merchant_id, menu_item_id,
   name)`.
3. Endpoint minimal untuk membuat/mengubah varian; baris transaksi menyimpan
   `variant_id` + snapshot nama/harga varian.
4. Test: transaksi dengan varian memakai harga override; varian tidak tersedia
   → `409`.

**Verification:** test snapshot + varian lulus; 220 tetap hijau.

## Task 13: OpenAPI 3.1 dari Zod

**Files:** `apps/api/src/openapi.js` (atau `docs/openapi.yaml` generator),
`apps/api/package.json`, test validasi skema.

**Steps:**
1. Hasilkan OpenAPI 3.1 dari skema Zod yang sudah dipakai validasi.
2. Sajikan di `GET /openapi.json` (tanpa auth, hanya spec).
3. Test: semua route utama muncul; spec valid terhadap schema OpenAPI 3.1.

**Verification:** `GET /openapi.json` → 200, `openapi: "3.1.0"`, memuat
`/pos/transactions` dan `/admin/inventory`.

## Task 14: Sinkronisasi docs + final review

**Files:** `plan/ROADMAP.md`, `plan/PLAN.md`, `README.md`, `AGENTS.md`.

**Steps:**
1. Centang item Fase 0 + Fase 1 yang sudah selesai di `plan/ROADMAP.md`.
2. Ganti angka test `206` menjadi `220`.
3. Perbarui PROGRESS di `plan/PLAN.md` (termasuk catatan Fase 1.5 sebagai fase
   berikutnya).
4. Perbarui `README.md` dengan struktur monorepo dan perintah baru.
5. Jalankan verifikasi akhir: `npm test`, `npm run lint`, `npm run build`.

**Verification:** tidak ada referensi `206` yang tersisa untuk jumlah test;
`npm test` → semua lulus.
