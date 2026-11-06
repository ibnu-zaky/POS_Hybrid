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
- Jalankan migrasi backend: `cd apps/api && npm run migrate`
- Seed dev backend: `cd apps/api && npm run seed-dev`

## Aturan implementasi

- Bahasa dokumen dan komentar: Indonesia.
- Backend tetap CommonJS kecuali file baru yang memang perlu TS.
- Jangan menambah dependency baru tanpa kebutuhan.
- Uang di aplikasi selalu integer rupiah; di DB hanya `NUMERIC(12,2)`.
- Semua tabel baru wajib memiliki `merchant_id` + RLS + isolation test.
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

- Nomor migrasi baru bertambah mengikuti kelipatan 019–023 sesuai roadmap.
- Migrasi harus idempotent bila mungkin.
- Gunakan pola `merchant_id` + `SET app.merchant_id` + RLS policy yang sudah dipakai di repo.

## Prinsip domain

- Menu, kupon, stok, laporan, dan order harus selalu milik merchant yang benar.
- Transaksi tidak boleh berubah tanpa audit yang jelas.
- Void harus non-destruktif; soft-delete atau status `voided` lebih aman daripada hard delete.
- Idempotency key harus unik per merchant dan payload.
