---
name: pos-domain
description: Domain knowledge untuk POS Hybrid: warung, menu, varian, stok, transaksi, refund, void, laporan, dan per-tenant RBAC. Memastikan invariant bisnis tetap konsisten saat perubahan implementasi.
---

# POS Domain

## Fokus domain

- Merchant dan tenant isolation untuk retail/F&B.
- Menu/catalog dan varian item dengan harga snapshot.
- Stok, pergerakan stok, dan overselling guard.
- Order, transaksi, pembayaran, refund, dan void.
- Shift, HR, laporan, dan dashboard.
- RBAC per-tenant dan audit append-only.

## Invariant utama

1. Setiap row bisnis milik tepat satu merchant.
2. Semua mutasi stok harus terdokumentasi dan tidak bisa menurunkan stok tanpa penjelasan.
3. Harga yang dipakai saat transaksi harus tetap konsisten untuk riwayat dan laporan.
4. Transaksi belum dibayar bisa void, tetapi paid/refunded harus lewat alur refund yang jelas.
5. Uang di aplikasi menjaga integer rupiah; rounding memakai aturan half-away-from-zero.
6. Idempotency key harus unik per merchant, dan payload yang berbeda harus ditolak.
7. Audit log tidak bisa dihapus atau diubah oleh aplikasi.

## Terminologi

- `merchant`: tenant utama dalam POS.
- `staff`: pengguna operasional dengan peran seperti admin, manager, cashier.
- `menu_item`: item katalog.
- `variant`: variasi menu item dengan override harga dan availability.
- `transaction`: entitas penjualan yang mencatat snapshot harga dan status.
- `voided`: status non-destruktif untuk transaksi yang dibatalkan sebelum dibayar.
- `payment_status`: status pembayaran seperti pending/paid/refunded.
- `fulfillment_status`: status order atau pesanan pelanggan.

## Aturan kerja

- Jangan menghapus data transaksi secara langsung ketika bisnis menginginkan pembatalan; gunakan status `voided` atau refund.
- Saat data berubah setelah transaksi dibuat, riwayat harus tetap stabil; gunakan snapshot.
- Untuk perubahan multi-tenant, pastikan policy dan query selalu memakai `merchant_id` dari tenant aktif.
- Jangan menulis PIN, token, atau secret di log atau respons.
