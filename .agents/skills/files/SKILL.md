---
name: offline-sync-idempotency
description: Aturan dan pola untuk sinkronisasi offline-ke-online, antrian outbox, retry, dan idempotensi pada POS multi-tenant. Gunakan skill ini setiap kali pekerjaan menyentuh mode offline, cache lokal, sync, retry request, double-submit atau klik ganda tombol bayar, webhook pembayaran, resolusi konflik, penomoran struk/order dari perangkat, atau tes yang berkaitan dengan itu, walau pengguna tidak menyebut kata "idempotensi" atau "sync" secara eksplisit. Use for offline-first, sync engine, outbox, idempotency key, conflict resolution, retry/backoff, duplicate transactions, offline sales.
---

# Offline sync dan idempotensi untuk POS

## Kenapa ini berbeda dari aplikasi biasa

Di POS, penjualan sudah terjadi di dunia nyata (barang diserahkan, uang diterima) sebelum server tahu. Dua akibatnya membentuk semua aturan di bawah:

1. Server tidak boleh menolak penjualan offline hanya karena konflik. Ia harus mencatatnya, lalu menandai ketidaksesuaian untuk direkonsiliasi.
2. Jaringan yang buruk menghasilkan retry. Tanpa penjagaan, retry menghasilkan transaksi ganda dan stok berkurang dua kali.

Skill ini melengkapi `pos-domain` (aturan uang, stok, audit, tenant). Jika ada pertentangan, aturan keselamatan data di `pos-domain` menang.

## Prinsip inti

1. **Tulis lokal dulu, kirim kemudian.** Kasir tidak boleh menunggu jaringan untuk menyelesaikan penjualan.
2. **Setiap mutasi punya identitas yang dibuat di klien sebelum dikirim**, disimpan durable, dan dipakai ulang di setiap retry. Alasannya: setelah timeout, klien tidak tahu apakah request pertama sampai. Hanya identitas yang sama yang memungkinkan server mengenali duplikat.
3. **Klien adalah sumber kebenaran untuk fakta yang terjadi di perangkat** (penjualan, pergerakan stok). **Server adalah penentu untuk data referensi** (harga, konfigurasi, hak akses).
4. **Fakta bersifat append-only.** Penjualan dan pergerakan stok tidak ditimpa; konflik diselesaikan dengan menjumlah atau menandai.
5. **Jangan percaya jam perangkat untuk urutan.** Jam bisa salah atau diubah. Gunakan nomor urut per perangkat dan versi dari server.
6. **Konflik tidak boleh hilang diam-diam.** Setiap konflik berakhir sebagai hasil yang terlihat: diterima, diterima dengan penyesuaian dan ditandai, atau masuk antrian tinjauan.

## Alur kerja

1. Klasifikasikan operasi yang ditangani (tabel di bawah).
2. Tetapkan kontrak idempotensi.
3. Bangun outbox lokal.
4. Bangun sync engine (push lalu pull).
5. Bangun penerima batch di server.
6. Tentukan kebijakan konflik per jenis data.
7. Tulis tes. Jangan menyatakan selesai tanpa menjalankannya (lihat `references/patterns.md` bagian 5).

Skema SQL, pseudocode handler server, pseudocode outbox/sync klien, dan daftar tes lengkap ada di `references/patterns.md`. Baca file itu sebelum menulis kode, bukan setelahnya.

## Klasifikasi operasi (default untuk POS)

| Data | Boleh offline? | Kebijakan |
|---|---|---|
| Penjualan tunai | Ya | Append-only. Server selalu menerima. Nomor resmi diberi server saat sync. |
| Penjualan non-tunai (QRIS, kartu, e-wallet) | Tidak dikonfirmasi offline | Jangan tandai lunas tanpa konfirmasi server atau gateway. Jika bisnis butuh, simpan sebagai "menunggu pembayaran". |
| Pergerakan stok akibat penjualan | Ya | Append-only, dijumlahkan. Saldo negatif ditandai untuk rekonsiliasi, tidak ditolak. |
| Penyesuaian stok manual | Ya, dengan izin | Append-only dengan alasan, masuk audit log. |
| Harga, produk, konfigurasi tenant | Baca offline, tulis online | Server menang. Pakai versi. |
| Pelanggan | Ya | Merge per field dengan versi. |
| Refund dan void | Online saja (default) | Jika diizinkan offline, batasi nilai dan wajib ditinjau setelah sync. |
| Hak akses dan peran | Baca saja | Server menang. |

## Kontrak idempotensi

- **Key**: UUID (v7 bila tersedia karena terurut), dibuat saat aksi pengguna dimulai. Simpan di outbox sebelum request pertama. Pakai ulang di semua retry. Jangan pernah membuat ulang saat retry.
- **Scope**: `(tenant_id, key)`. Key yang sama di tenant lain tidak boleh bertabrakan.
- **Hash payload**: server menyimpan hash isi request. Key sama dengan isi berbeda berarti bug klien, jawab 422. Menerimanya diam-diam menyembunyikan bug.
- **Satu transaksi**: efek bisnis (order, pergerakan stok, audit log) dan catatan key ditulis dalam SATU transaksi database. Jika terpisah, crash di antaranya meninggalkan efek tanpa catatan atau sebaliknya, dan retry berikutnya menggandakan efek.
- **Replay**: request ulang mengembalikan respons yang sama (status dan isi) seperti yang pertama.
- **TTL**: simpan key lebih lama dari batas offline terpanjang yang didukung (mis. 30 hari atau lebih), bukan 24 jam. Perangkat bisa offline berhari-hari.
- **Klik ganda**: nonaktifkan tombol saat submit DAN ikat key ke percobaan checkout, sehingga dua klik berarti satu key.
- **Webhook gateway**: dedupe dengan event id dari gateway, verifikasi signature pada raw body, dan catat event id dalam transaksi yang sama dengan efeknya. Gateway mengirim ulang event; urutan tidak dijamin.
- Alternatif yang lebih sederhana untuk entitas utama: kolom `client_op_id` dengan `UNIQUE(tenant_id, client_op_id)` pada tabel `orders`. Duplikat mengembalikan order yang sudah ada.

## Outbox lokal

- Simpan di penyimpanan durable (SQLite atau IndexedDB). Jangan localStorage atau memori: data hilang saat tekanan penyimpanan atau muat ulang.
- Tulis efek lokal (catatan penjualan, pergerakan stok lokal) dan baris outbox dalam satu transaksi lokal. Jika terpisah, kasir bisa melihat penjualan yang tidak pernah terkirim.
- Kolom minimal: `op_id` (= idempotency key), `tenant_id`, `device_id`, `device_seq` (naik monoton per perangkat), `type`, `payload`, `created_at_client`, `status`, `attempts`, `next_retry_at`, `last_error`, `depends_on`.
- Jangan hapus baris sebelum ack dari server. Setelah ack, tandai `acked` dan bersihkan setelah masa retensi.

## Sync engine

- **Single-flight**: hanya satu sync berjalan. Pemicu (online, app start, resume, setelah tulis dengan debounce) digabung. Event jaringan sering menembak berkali-kali berurutan.
- **Push dulu, lalu pull.** Kirim berurutan menurut `device_seq`.
- **Retry**: exponential backoff dengan jitter. Bedakan error sementara (jaringan, 5xx, 429: retry) dari permanen (4xx validasi: karantina, jangan diulang tanpa batas).
- **Karantina**: operasi yang gagal permanen terlihat di UI (jumlah dan alasan) dan bisa diekspor untuk dukungan. Operasi lain yang tidak bergantung padanya tetap berjalan. Operasi yang bergantung (mis. refund atas penjualan yang dikarantina) ikut dikarantina.
- **Pull**: gunakan cursor atau versi dari server, bukan timestamp. Dukung tombstone untuk penghapusan. Terapkan data dan simpan cursor dalam satu transaksi lokal.
- **Token kedaluwarsa saat offline**: antrian tetap tersimpan, sync lanjut setelah login ulang. Server memvalidasi bahwa pengguna masih aktif di tenant itu dan mencatat aktor aslinya di audit log.
- **Status terlihat**: tampilkan jumlah menunggu, waktu sync sukses terakhir, dan error.

## Penerima batch di server

- Proses per operasi dan kembalikan hasil per operasi: `applied`, `duplicate` (replay), `adjusted` (diterima dengan penyesuaian dan ditandai), `rejected` (dengan alasan). Satu operasi buruk tidak boleh menggagalkan seluruh batch.
- **Penomoran**: perangkat offline tidak bisa memakai urutan global. Struk offline memakai nomor lokal (`device_id` + `device_seq`). Nomor resmi diberikan server saat sync. Simpan keduanya dan tampilkan nomor lokal di struk yang sudah tercetak.
- Cek isolasi tenant di setiap operasi dalam batch, bukan hanya di header batch.

## Kebijakan konflik

- **Stok**: jumlahkan pergerakan. Jika saldo menjadi negatif, terima penjualan (barang sudah keluar) dan buat penanda rekonsiliasi. Menolaknya membuat pembukuan berbeda dari kenyataan.
- **Harga**: simpan snapshot harga yang dipakai di baris penjualan. Perubahan harga setelahnya tidak boleh mengubah riwayat.
- **Data referensi diedit dari dua perangkat**: gunakan versi (optimistic concurrency). Field berbeda di-merge. Field sama: server menang atau masuk antrian tinjauan, tetapkan eksplisit per entitas.
- **Update vs hapus**: hapus menang kecuali kebijakan entitas menyatakan lain. Gunakan tombstone.
- **Urutan**: simpan `client_created_at` dan `server_received_at`, tetapi urutkan dengan `device_seq` dan versi server.

## Kesalahan yang sering terjadi (hindari)

- Membuat ulang idempotency key pada setiap retry.
- Menyimpan catatan key dan efek bisnis di transaksi terpisah.
- Menolak penjualan offline yang membuat stok negatif.
- Memakai timestamp perangkat untuk menentukan "yang terbaru menang" pada data transaksi.
- Menandai pembayaran elektronik lunas dari sisi klien.
- Sync tanpa single-flight sehingga batch yang sama terkirim paralel.
- Retry tanpa batas pada error validasi yang tidak akan pernah berhasil.
- TTL key 24 jam padahal perangkat bisa offline lebih lama.
- Antrian di localStorage.

## Sebelum menyatakan selesai

Jalankan dan tampilkan output tes untuk minimal: kirim ganda, crash setelah commit sebelum respons, request kembar bersamaan, key sama dengan isi berbeda, penjualan offline yang membuat stok negatif, dua perangkat mengedit harga yang sama, dan isolasi key antar tenant. Daftar lengkap ada di `references/patterns.md` bagian 5.
