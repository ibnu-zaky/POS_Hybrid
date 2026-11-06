---
name: offline-sync-idempotency
description: Aturan dan pola untuk sinkronisasi offline-ke-online, antrian outbox, retry, dan idempotensi pada POS multi-tenant. Gunakan skill ini setiap kali pekerjaan menyentuh mode offline, cache lokal, sync, retry request, double-submit atau klik ganda tombol bayar, webhook pembayaran, resolusi konflik, penomoran struk/order dari perangkat, atau tes yang berkaitan dengan itu, walau pengguna tidak menyebut kata "idempotensi" atau "sync" secara eksplisit.
---

# Offline sync dan idempotensi untuk POS

## Prinsip inti

1. Tulis lokal dulu, kirim kemudian.
2. Setiap mutasi punya identitas idempotency key yang dibuat sebelum submit.
3. Server harus mendeteksi duplikat dan replay payload yang sama.
4. Konflik harus terlihat dan terdokumentasi, bukan dihapus diam-diam.
5. Stok, audit, dan pembayaran harus menangani retry dengan pola yang aman.

## Standar yang dipakai repo

- Key idempotency dipakai per merchant, bukan global.
- Request hash didefinisikan dari method, pathname nyata, dan payload canonical.
- Replay sukses tetap mengembalikan status 200 + `replayed: true`.
- Konflik payload yang sama key namun isi berbeda harus ditolak dengan `422 IDEMPOTENCY_PAYLOAD_MISMATCH`.
- Outbox harus durable dan tidak boleh hanya dijaga di memory.

## Panduan implementasi

- Simpan key dan response body saat pertama kali diterima.
- Pada retry, cek key; bila hash sama, replay response yang sama.
- Bila hash berbeda, tolak eksplisit agar bug klien tidak tersembunyi.
- Untuk stok, gunakan append-only movement dan rekonsiliasi bila saldo negatif terdeteksi.
- Batasi mutasi yang boleh offline dan tetap minta konfirmasi server untuk status pembayaran final.
