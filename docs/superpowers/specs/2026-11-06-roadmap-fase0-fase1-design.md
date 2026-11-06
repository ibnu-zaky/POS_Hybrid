# Desain: Retrofit Fase 0 → Selisih Fase 1

Tanggal: 2026-11-06
Status: Disetujui
Sumber otoritatif: `plan/ROADMAP.md`
Plan eksekusi: `docs/plans/2026-11-06-fase0-fase1-retrofit.md`

## Tujuan

Menjadikan `plan/ROADMAP.md` sebagai patokan repo, lalu menutup selisih antara
kondisi repo saat ini dan Fase 0 + Fase 1 ROADMAP. Repo tidak ditulis ulang:
semua perubahan adalah retrofit bertahap di atas 220 test yang sudah hijau.

## Non-goals

- Fase 2 (offline-first penuh) tidak direncanakan detail di sini.
- Fase 3 (microkernel) tidak direncanakan detail di sini.
- Fase 1.5 (integrasi frontend ↔ API) tetap fase berikutnya, bukan cakupan plan ini.
- Tidak mengganti stack, ORM, atau test framework.

## Keputusan

1. **Retrofit bertahap.** Urutan: Fase 0 dulu, lalu selisih Fase 1. Setiap task
   wajib menjaga 220 test lama tetap hijau.
2. **TypeScript gradual.** Root `allowJs + checkJs` aktif; file baru wajib TS;
   `packages/core` TS strict sejak awal; backend CommonJS dikonversi per modul
   saat modul disentuh. CI menyimpan baseline jumlah error `checkJs` `apps/api`
   (±48) dan gagal bila naik.
3. **Void non-destruktif.** Hanya transaksi belum bayar yang boleh di-void.
   Paid/refunded wajib lewat alur refund yang ada. Status baru `voided`.
   Void = tandai status + movement stok tipe `void`, tanpa DELETE baris.
   Laporan mengecualikan void (filter `status='completed'` sudah ada).
4. **Idempotency generik.** Tabel `idempotency_keys(merchant_id, key,
   request_hash, response_status, response_body, created_at)` dengan UNIQUE
   `(merchant_id, key)`. Kolom `transactions.idempotency_key` dipertahankan.
   Envelope replay tetap `200 + replayed:true`. Hash =
   `sha256(method + pathname_nyata + canonicalJson(payloadZod))`. Attempt gagal
   tidak mengunci key (rollback ikut). Race diselesaikan dengan
   `INSERT ... ON CONFLICT DO NOTHING RETURNING`; key sama + hash beda → `422
   IDEMPOTENCY_PAYLOAD_MISMATCH`.
5. **Uang.** Batas DB hanya `NUMERIC(12,2)`; di aplikasi uang selalu integer
   rupiah. Pembulatan `roundHalfUp` (half-away-from-zero). `Math.round` tidak
   dipakai untuk negatif. `NUMERIC` diparse ke integer di boundary.
6. **Permission per-tenant.** `permissions` DAN `role_permissions` sama-sama
   punya `merchant_id` + RLS. Bukan katalog global. `requirePermission`
   menggantikan allow-list role di 26 call site `authorize(...)`.
7. **Varian minimal.** `menu_item_variants` per menu item (nama, sku, harga
   override, available). Baris transaksi menyimpan snapshot varian. Snapshot
   harga = formalisasi kolom denormalisasi yang ada + test.
8. **Audit.** `audit_logs` per-tenant (rename dari tabel lama + backfill),
   `REVOKE UPDATE, DELETE, TRUNCATE`, RLS. Login menulis audit dengan konteks
   tenant.
9. **Penomoran.** Tabel baru wajib `merchant_id` (konvensi repo; padanan
   `tenant_id` di ROADMAP) + RLS + test isolasi tenant. Migrasi baru nomor
   019–023.
10. **Docs/angka.** Saat ROADMAP dicentang, angka test `206` diganti `220`.
    Skill `pos-domain` ditulis dari ROADMAP + ADR. Skill offline yang path-nya
    janggal dipindah ke `.agents/skills/offline-sync-idempotency/SKILL.md`.

## Dampak

- `DELETE /pos/transactions/:id` berubah dari hard-delete menjadi void;
  respons dan efek restock tetap kompatibel dengan test lama.
- `computeTotals` pindah ke `@pos/core` dan di-re-export dari
  `transaction.service.js` agar import test lama tetap jalan.
- Semua tabel baru memakai RLS, sehingga test DB butuh role aplikasi yang
  tidak melewati RLS (sudah jadi pola repo).
