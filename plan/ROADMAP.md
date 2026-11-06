# POS_Hybrid Master Roadmap

**Tujuan:** POS system general/flexible seperti WordPress. Client mengatur fitur aktif dan UI/UX sendiri, dengan arsitektur modular (microkernel).

**Pendekatan:** retrofit bertahap. Kode yang sudah ada (206 test hijau) dipertahankan, direstrukturisasi ke monorepo, lalu selisih terhadap roadmap ditutup berurutan berdasarkan risiko.

**Stack:** TypeScript full-stack, Postgres (RLS), SQLite/IndexedDB di client, PWA dulu. Migrasi TS bertahap: `allowJs` + `checkJs`, file baru wajib TS, `packages/core` TS sejak awal, backend CommonJS dikonversi per modul saat disentuh.

**Legenda status:** ✅ sudah ada | 🟡 sebagian | ❌ belum ada

---

## Kondisi Saat Ini (hasil audit)

Struktur: `backend/` (JS CommonJS) + `frontend/` (TS) + `migrations/`, tanpa workspaces.

| Area | Status | Catatan |
|---|---|---|
| Multi-tenant RLS | ✅ | |
| Inventory append-only + anti-oversell | ✅ | |
| Sales/transaksi | ✅ | |
| Idempotency di transaksi | 🟡 | replay 200 diam-diam, belum generik, belum ada 422 |
| Audit log | 🟡 | hanya auth/payment; belum `occurred_at`/`received_at` |
| RBAC | 🟡 | role allow-list, belum permission-based |
| Void/refund | ❌ | void = hard delete (melanggar invariant) |
| Modul uang terpusat | ❌ | pembulatan tersebar |
| Varian produk, price snapshot | ❌ | |
| Tes dua kasir stok terakhir | ❌ | |
| OpenAPI | ❌ | |
| ADR, monorepo, AGENTS.md | ❌ | |
| CI | 🟡 | hanya backend; frontend belum lint/build |
| Frontend ↔ API | ❌ | localStorage/seed, nol panggilan API |
| Offline (IndexedDB/PWA/SSE) | ❌ | |
| Microkernel/plugin | ❌ | |

---

## Fase 0: Fondasi & Restrukturisasi (1-1,5 minggu)

**Tujuan:** baseline bersih, struktur monorepo, keputusan terdokumentasi, perilaku tidak berubah.

Urutan kerja:
1. [ ] Commit/stash perubahan yang belum di-commit; hapus file sampah (`ole.log(...)`).
2. [ ] Pastikan **206 test hijau** sebagai baseline.
3. [ ] Restrukturisasi monorepo tanpa mengubah perilaku (`git mv`, workspaces, perbaiki import): `apps/api`, `apps/web`, `packages/core`, `packages/plugin-sdk`, `plugins/*`.
4. [ ] Verifikasi: 206 test tetap hijau setelah restrukturisasi.
5. [ ] ADR: stack, platform client, DB, multi-tenant (shared schema + `tenant_id` + RLS), ID (UUIDv7), strategi migrasi TS.
6. [ ] `AGENTS.md`: rujukan skill, aturan "TDD wajib untuk domain uang/stok".
7. [ ] CI: lint + typecheck + test + build untuk backend **dan frontend**.
8. [ ] Pasang skill `pos-domain` dan `offline-sync-idempotency` di `.agents/skills/`.

**Exit criteria:** CI hijau untuk kedua app; 206 test hijau; ADR dan AGENTS.md ter-commit.
**Skill:** `brainstorming`, `writing-plans`, `using-git-worktrees`, `verification-before-completion`.

---

## Fase 1: Core Domain, Tutup Selisih (2-3 minggu)

**Tujuan:** semua invariant `pos-domain` terpenuhi dan terbukti oleh tes. Urutan berdasarkan **risiko**, bukan urutan fitur.

| # | Tugas | Alasan prioritas |
|---|---|---|
| 1 | **Void/refund jadi catatan pembalik** (hapus hard delete), masuk audit | Melanggar invariant, paling berbahaya |
| 2 | **Idempotency generik** (tenant_id, key) UNIQUE; payload beda → 422; replay mengembalikan hasil tersimpan | Mencegah transaksi ganda |
| 3 | **Modul uang terpusat** di `packages/core` (integer, satu aturan pembulatan, pajak per-baris atau per-invoice: putuskan di ADR) | Kebenaran angka |
| 4 | **Audit**: `occurred_at`, `received_at`, `device_id`; cakup harga, stok manual, hak akses, konfigurasi, refund, void | Dibutuhkan sebelum offline |
| 5 | **Tes wajib #4**: dua kasir menjual stok terakhir bersamaan → hanya satu berhasil | Bukti anti-oversell |
| 6 | **Permission-based RBAC** (role + permission, dicek di backend per endpoint) | Fondasi plugin permission |
| 7 | **Price snapshot** di line items; **varian produk** | Dibutuhkan offline & laporan |
| 8 | **OpenAPI** dihasilkan dari kode yang sudah stabil | Terakhir, agar tidak berubah-ubah |

**Tes wajib (output harus benar-benar dijalankan):**
1. Request sama 2x → 1 transaksi; key sama + payload beda → 422.
2. Penjualan + stok atomik (gagal salah satu → rollback keduanya).
3. Tenant A tidak bisa baca/ubah data tenant B (termasuk lewat RLS).
4. Dua kasir, stok terakhir → satu berhasil.
5. Unit test pembulatan dengan kasus tepi.
6. Void/refund tidak menghapus data lama; saldo stok dan kas tetap konsisten.

**Exit criteria:** semua tes hijau dengan output nyata; OpenAPI tersedia; tidak ada hard delete pada data transaksi.
**Skill:** `test-driven-development`, `pos-domain`, `verification-before-completion`, `requesting-code-review`.

---

## Fase 1.5: Hubungkan Frontend ke API, Online Dulu (2-3 minggu) **[BARU]**

**Tujuan:** frontend berhenti memakai localStorage/seed dan berbicara dengan backend. Offline di atas frontend yang belum terintegrasi akan sulit di-debug.

- [ ] API client terketik (dibangun dari OpenAPI).
- [ ] Auth flow nyata (login, refresh, logout, penanganan 401/403).
- [ ] Katalog, keranjang, checkout tunai, riwayat transaksi lewat API.
- [ ] Idempotency key dibuat di client saat transaksi dibuat (bukan saat kirim).
- [ ] State loading/error/retry yang jelas; hapus data seed dan localStorage sebagai sumber data.
- [ ] Tes e2e alur kasir utama (Playwright).

**Exit criteria:** alur kasir lengkap berjalan online tanpa data seed; e2e hijau di CI.
**Skill:** `playwright-cli`, `frontend-design`, `web-design-guidelines`.

---

## Fase 2: Offline-First Client & Sync (3-4 minggu)

**Tujuan:** kasir tetap bisa jualan tanpa internet.

- [ ] IndexedDB + snapshot master data (produk, harga, pajak) dengan `version`.
- [ ] Checkout offline: total dari snapshot; ID dan idempotency key dari client.
- [ ] Outbox: transaksi + outbox row dalam satu transaksi lokal.
- [ ] Sync worker: single-flight, urut per device, exponential backoff + jitter, poison message → `failed`.
- [ ] Server menghitung ulang total; selisih → `needs_review`, bukan ditolak.
- [ ] Stok offline diterima apa adanya, boleh negatif, masuk laporan diskrepansi.
- [ ] Pembayaran non-tunai offline → `pending_confirmation`.
- [ ] Kebijakan konflik: penjualan append-only, stok = jumlah movement, harga = server menang.
- [ ] PWA (service worker, installable); UI status sync: pending / synced / failed.
- [ ] SSE/polling untuk pembaruan master data (putuskan di ADR).

**Tes wajib:**
1. Putus koneksi di tengah sync → tidak ada duplikat atau hilang.
2. Dua device edit data sama saat offline → hasil sesuai kebijakan.
3. Server restart saat sync → retry aman.
4. Clock device salah → urutan tidak rusak (server memakai `received_at`).

**Exit criteria:** simulasi jaringan buruk (offline, throttling, packet drop) lulus.
**Skill:** `offline-sync-idempotency`, `playwright-cli`.

---

## Fase 3: Microkernel & Plugin System (3-4 minggu)

**Tujuan:** core minimal, fitur lain jadi plugin.

**Kernel hanya berisi:** plugin loader, registry, lifecycle, event bus, permission, config per-tenant, service container.

**Kontrak plugin:**
- `manifest.json`: id, versi, `requires` (kernel + plugin lain), permission diminta, extension point.
- Lifecycle: `install → activate → deactivate → uninstall`, plus `migrate`.
- Extension point: hook/event (`order.beforeCreate`, `order.completed`), slot UI, route, menu, setting schema.
- Aktif/nonaktif **per tenant**.

**Aturan:**
- Sales dan inventory tetap **core**, tidak bisa dinonaktifkan. Plugin hanya memperluas invariant, tidak mematahkannya (tidak boleh melewati idempotency atau audit).
- Tabel plugin berprefix dan selalu memuat `tenant_id`.
- Kandidat plugin: diskon/promo, loyalty, multi-outlet, laporan tambahan.

**Tes wajib:**
1. Plugin crash tidak menjatuhkan kernel.
2. Nonaktifkan plugin → data utuh, UI bersih.
3. Plugin tenant A tidak aktif di tenant B.
4. Konflik dependensi/versi ditolak saat install.

**Exit criteria:** minimal 3 plugin nyata berjalan di atas SDK tanpa mengubah kode core.
**Skill:** `architecture-paradigm-microkernel`, `improve-codebase-architecture`.

---

## Fase 4: Kustomisasi UI/UX (2-3 minggu)

- [ ] Design tokens per tenant, theming runtime.
- [ ] Layout berbasis slot/widget registry (keranjang, grid produk, pencarian).
- [ ] Preset tema + editor sederhana, disimpan sebagai config tenant.
- [ ] Mode kasir: touch-friendly, shortcut keyboard, kontras dan aksesibilitas.
- [ ] Batasi kustomisasi agar alur kritis tidak rusak (tombol bayar tidak bisa disembunyikan).

**Exit criteria:** 2 tenant dengan tampilan dan fitur berbeda dari build yang sama.
**Skill:** `design-taste-frontend`, `frontend-design`, `web-design-guidelines`.

---

## Fase 5: Pembayaran & Hardware (2-3 minggu)

- [ ] Gateway pembayaran sebagai plugin (QRIS/e-wallet): verifikasi signature webhook, status dipercaya dari server, idempotent terhadap webhook ganda.
- [ ] Struk (ESC/POS atau cetak browser), cash drawer, barcode scanner (keyboard wedge dulu).
- [ ] Shift kasir: buka/tutup kas, selisih kas.

**Tes wajib:** webhook 2x → 1 pembayaran; webhook palsu ditolak; pembayaran pending terekonsiliasi setelah online.

---

## Fase 6: Back-Office & Pelaporan (2-3 minggu)

- [ ] Laporan penjualan, laba kotor, stok, per kasir/outlet, filter periode.
- [ ] Layar rekonsiliasi: `needs_review`, stok negatif, pembayaran pending.
- [ ] Stok opname dan penyesuaian manual (masuk audit).
- [ ] Export CSV/PDF.
- [ ] Tes konsistensi: laporan cocok dengan agregasi ledger.

---

## Fase 7: Ekosistem Plugin (2-3 minggu)

- [ ] `plugin-sdk` terdokumentasi, generator `create-pos-plugin`.
- [ ] Harness uji plugin terhadap kernel palsu.
- [ ] Sandboxing/izin sesuai manifest.
- [ ] Distribusi lokal/Git dulu, marketplace belakangan.
- [ ] Panduan penulisan plugin + 3 contoh resmi.

---

## Fase 8: Hardening & Rilis (2-3 minggu)

- **Keamanan:** audit OWASP, rate limit, secret management, enkripsi data lokal sensitif, review RLS.
- **Performa:** load test checkout dan sync batch besar; indeks DB; ukuran bundle.
- **Operasional:** backup + uji restore, migrasi tanpa downtime, logging terstruktur, metrik, alert.
- **Rilis:** pilot di 1 toko nyata, kumpulkan feedback, baru buka ke client lain.

**Skill:** `requesting-code-review`, `finishing-a-development-branch`.

---

## Fase 9: Pasca-rilis

Multi-outlet lanjutan, integrasi marketplace, aplikasi mobile native, analitik, billing/langganan tenant, marketplace plugin.

---

## Timeline (disesuaikan setelah audit)

| Fase | Durasi | Kumulatif (minggu) |
|---|---|---|
| 0 Fondasi & restrukturisasi | 1-1,5 | 1,5 |
| 1 Core, tutup selisih | 2-3 | 4,5 |
| 1.5 Frontend ↔ API | 2-3 | 7,5 |
| 2 Offline | 3-4 | 11,5 |
| 3 Microkernel | 3-4 | 15,5 |
| 4 UI/UX | 2-3 | 18,5 |
| 5 Payment/HW | 2-3 | 21,5 |
| 6 Reporting | 2-3 | 24,5 |
| 7 Ekosistem | 2-3 | 27,5 |
| 8 Hardening | 2-3 | 30,5 |

Estimasi untuk satu orang paruh waktu. **Fase 0-3 (termasuk 1.5) = MVP yang layak dipilot.** Fase 1 lebih singkat dari rencana awal karena sebagian besar fondasinya sudah ada, tetapi Fase 1.5 menambah waktu karena frontend belum terintegrasi.

## Risiko Utama

1. **Restrukturisasi monorepo merusak test.** Mitigasi: pindah tanpa ubah perilaku, 206 test harus hijau sebelum dan sesudah.
2. **Migrasi TS tersendat.** Mitigasi: bertahap per modul, `allowJs`, jangan tulis ulang massal.
3. **Over-engineering plugin terlalu dini.** Mitigasi: kernel baru di Fase 3, setelah domain stabil.
4. **Sync offline lebih sulit dari perkiraan.** Mitigasi: Fase 1.5 dulu, kebijakan konflik sesederhana mungkin, uji dengan simulasi jaringan.
5. **Scope creep.** Mitigasi: fitur baru wajib lewat `brainstorming` dan masuk fase yang tepat.
6. **Kebocoran data antar tenant.** Mitigasi: RLS + tes isolasi di CI.

## Alur Kerja Tiap Fase

`brainstorming` → `writing-plans` → `using-git-worktrees` → `test-driven-development` → `verification-before-completion` → `requesting-code-review` → `finishing-a-development-branch`

Plan detail per fase disimpan di `docs/plans/YYYY-MM-DD-nama-fase.md`; dokumen ini hanya gambaran besar.
