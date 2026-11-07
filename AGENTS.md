# AGENTS.md

## Ringkasan proyek

POS Hybrid adalah monorepo untuk point-of-sale retail dan F&B dengan:
- `apps/api` untuk backend Express + PostgreSQL + RLS
- `apps/web` untuk frontend React + Vite
- `packages/core` untuk utilitas bisnis yang harus dipakai ulang
- `migrations/` untuk migrasi SQL yang dipakai di development dan CI

## Perintah penting

- Install semua workspace: `npm install`
- Jalankan semua test API: `npm test --workspace apps/api`
- Jalankan test penuh root: `npm test`
- Lint frontend: `npm run lint --workspace apps/web`
- Build frontend: `npm run build --workspace apps/web`
- Typecheck core: `npx tsc --noEmit -p packages/core`
- Jalankan migrasi backend: `cd apps/api && npm run migrate`
- Seed dev backend: `cd apps/api && npm run seed-dev`

## Aturan implementasi

- Bahasa dokumen dan komentar: Indonesia.
- Backend tetap CommonJS kecuali file baru yang memang perlu TS.
- Jangan menambah dependency baru tanpa kebutuhan. Pengecualian harus dicatat di ADR atau `docs/DECISIONS-LOG.md`.
- Uang di aplikasi selalu integer rupiah; di DB hanya `NUMERIC(12,2)`. Dilarang float untuk nilai uang.
- Semua pembulatan uang hanya lewat `packages/core`. Jangan memakai `Math.round`/`toFixed` untuk uang di luar core.
- `NUMERIC` dari DB dikonversi ke integer hanya di satu fungsi boundary (`toRupiah`), bukan `parseFloat` tersebar.
- Semua tabel baru wajib memiliki `merchant_id` + RLS + isolation test. (`merchant_id` di repo = `tenant_id` di ROADMAP.)
- Jangan commit `.env`, secret, token, atau artefak lokal.
- Saat memutuskan antara fleksibilitas dan keamanan, pilih keamanan dan tenant isolation.

## Struktur monorepo

```text
apps/api/      backend REST API
apps/web/      frontend Vite React
packages/core/ domain logic dan helper
migrations/    migrasi SQL untuk PostgreSQL
plan/          roadmap dan perencanaan produk
docs/          ADR, design docs, dan rencana retrofit
```

## Migrasi

- Migrasi baru dalam plan retrofit memakai nomor 019-023 (void, idempotency, audit, permission, varian). Migrasi berikutnya lanjut berurutan setelah 023.
- Migrasi harus idempotent bila mungkin.
- Gunakan pola `merchant_id` + `SET app.merchant_id` + RLS policy yang sudah dipakai di repo.
- Tabel yang baru dibuat memakai `FORCE ROW LEVEL SECURITY`; uji dengan role aplikasi yang sebenarnya, bukan owner tabel.

## Prinsip domain

- Menu, kupon, stok, laporan, dan order harus selalu milik merchant yang benar.
- Transaksi tidak boleh berubah tanpa audit yang jelas.
- Void harus non-destruktif; status `voided` + movement pembalik, tanpa hard delete. Hanya transaksi belum bayar yang boleh di-void; paid/refunded lewat refund.
- Idempotency key unik per merchant. Key sama + payload beda = 422, bukan replay.
- Claim key dan penyimpanan response terjadi dalam transaksi DB yang sama dengan penjualan.
- Total dihitung ulang di server dan menjadi sumber kebenaran.
- Rujukan wajib: skill `pos-domain` dan `offline-sync-idempotency` di `.agents/skills/`.

## Mode Eksekusi Otonom

Plan sudah disetujui: `docs/plans/2026-11-06-fase0-fase1-retrofit.md`.
Jalankan task berurutan TANPA bertanya di antara task atau fase.

### Loop per task

1. Tulis test dulu (TDD) dan lihat gagal. Wajib untuk uang, stok, void, idempotency.
2. Implementasi minimal sampai hijau.
3. Jalankan `npm test`, `npm run lint`, `npm run build` (sesuai yang sudah ada di task itu). Baca outputnya, jangan berasumsi.
4. Jika merah: debug dengan skill `systematic-debugging` (akar masalah dulu), perbaiki, ulangi dari langkah 3.
5. Jika hijau: commit kecil ("task N: ..."), centang task di plan, update PROGRESS di `plan/PLAN.md`, lanjut ke task berikutnya.

### Jangan minta persetujuan untuk

- pindah ke task atau fase berikutnya
- memilih nama file, fungsi, atau detail implementasi
- memperbaiki test yang gagal akibat perubahan sendiri

Jika ada keputusan kecil yang ambigu: pilih opsi paling konsisten dengan ADR, catat di `docs/DECISIONS-LOG.md` (apa, kenapa, alternatif), lalu lanjut.

### BERHENTI dan tanya HANYA jika

- test masih merah setelah 3 percobaan perbaikan yang berbeda
- butuh aksi destruktif (drop data, force push, hapus branch)
- butuh secret, kredensial, atau akun eksternal
- keputusan bertentangan dengan ADR atau mengubah isi plan
- jumlah test turun dari baseline 220 tanpa alasan yang tertulis di plan

### Larangan keras

- Dilarang melonggarkan atau menghapus assertion test lama. Test lama hanya boleh diubah bila plan menyatakannya (contoh: test hard-delete di Task 6).
- Dilarang melewati hook, lint, atau typecheck dengan flag atau komentar penghindar.
- Kerja hanya di branch `retrofit/fase0-fase1`. Jangan push, jangan merge ke `main`.
- Klaim "selesai" hanya dengan output test yang benar-benar dijalankan: idempotensi, atomisitas penjualan+stok, isolasi tenant, dan konflik sync (ikuti skill `verification-before-completion`).

### Task berisiko tinggi (6-12)

Void, idempotency, uang, audit, tes stok, permission, varian dikerjakan **berurutan, tidak paralel**: semuanya menyentuh `transaction.service.js` dan nomor migrasi.

### Melanjutkan di sesi baru

Baca `plan/PLAN.md` (bagian PROGRESS), `git log --oneline`, dan `docs/DECISIONS-LOG.md`. Lanjutkan dari task pertama yang belum tercentang. Jalankan test dulu untuk memastikan baseline masih hijau.

### Review manusia

Review dipindah ke akhir. Sebelum merge, baca `git log`, `docs/DECISIONS-LOG.md`, dan diff Task 6-12.