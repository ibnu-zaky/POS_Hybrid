# Peran
Kamu frontend engineer yang teliti. Bangun prototype sistem kasir (POS) kafe/warung bernama "Warung Kapur".
Ikuti spesifikasi ini. Jangan menambah fitur, warna, atau library di luar spesifikasi.

# Tiga tampilan dalam satu aplikasi
Satu codebase, satu design system, tiga tampilan dengan rute terpisah:

| Tampilan  | Rute                         | Pengguna         | Perangkat utama   | Layout                                  |
|-----------|------------------------------|------------------|-------------------|-----------------------------------------|
| Kasir     | /kasir, /kasir/pesanan-masuk, /kasir/riwayat | Kasir (PIN) | Tablet/laptop | Sidebar + menu + panel pesanan (3 kolom) |
| Admin     | /admin, /admin/menu, /admin/kategori, /admin/meja, /admin/laporan, /admin/pengaturan | Pemilik (PIN) | Laptop | Sidebar + konten lebar (2 kolom) |
| Pelanggan | /m/:meja?t=:token, /m/:meja/status | Pelanggan, tanpa login, scan QR di meja | HP | 1 kolom, tanpa sidebar permanen |
Tambahan: /login (pilih peran Kasir atau Admin, lalu keypad PIN).

Ketiganya memakai komponen dan gaya yang sama. Perbedaan dibuat tanpa warna (hanya hitam putih):
- Stempel peran di header: Kasir = kotak bergaris tunggal bertuliskan "Kasir"; Admin = kotak bergaris ganda bertuliskan "Admin"; Pelanggan = stempel "Meja 4".
- Bingkai papan: Kasir 12px solid, Admin 12px double, Pelanggan 6px solid.
- Isi sidebar berbeda (lihat bagian Sidebar). Judul halaman selalu tampil di header.

# Tech stack
- React 18 + Vite + TypeScript + CSS biasa dengan CSS variables. TANPA Tailwind, TANPA UI kit.
- Hanya dua library tambahan yang boleh: `react-router-dom` (routing) dan `qrcode` (membuat QR meja yang bisa di-scan). Selain itu dilarang.
- Tanpa backend. Data di localStorage (selalu dibungkus try/catch).
- Font Google Fonts: "Caveat Brush" (judul, angka besar), "Patrick Hand" (teks lain). Fallback: 'Chalkboard SE','Comic Sans MS',cursive.

# Arah visual: papan tulis kapur, hanya hitam dan putih
UI tampak digambar dengan kapur putih di papan tulis hitam. TIDAK ADA warna lain. Tanpa gradient dekoratif, tanpa emoji.

Dua tema lewat atribut data-theme di <html>:
- dark (default):  --board:#222222 --chalk:#f4f4f4 --dim:#a8a8a8 --faint:rgba(255,255,255,.18) --frame:#3a3a3a --smudge:rgba(255,255,255,.055)
- light (whiteboard): --board:#f5f5f5 --chalk:#1c1c1c --dim:#666666 --faint:rgba(0,0,0,.18) --frame:#c8c8c8 --smudge:rgba(0,0,0,.04)
Semua warna HARUS lewat variabel ini. Tombol ganti tema ada di header, pilihan disimpan di localStorage.

## Tekstur kapur (wajib ikuti)
1. Taruh SVG filter ini sekali di index.html (width=0 height=0, position:absolute):
   <filter id="rough" x="-4%" y="-4%" width="108%" height="108%">
     <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="w"/>
     <feDisplacementMap in="SourceGraphic" in2="w" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
     <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="g"/>
     <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -0.55" result="m"/>
     <feComposite in="d" in2="m" operator="in"/>
   </filter>
   Filter kedua id="grain": sama, tetapi displacement scale=1.6 dengan baseFrequency 0.05, noise baseFrequency 0.95.
   "grain" khusus untuk judul dan angka besar.
2. Class .box: position:relative; isolation:isolate. Garis tepi digambar di ::before
   (position:absolute; inset:0; z-index:-1; border:2.5px solid var(--chalk); filter:url(#rough); pointer-events:none).
   JANGAN pasang filter langsung pada elemen berisi teks isi.
3. Border-radius tidak simetris, pakai 3 variasi bergantian:
   --r1: 16px 5px 18px 7px / 7px 16px 5px 18px
   --r2: 6px 18px 8px 16px / 16px 6px 18px 8px
   --r3: 12px 8px 20px 5px / 8px 18px 6px 14px
4. Debu kapur: dua pseudo-element di body (fixed, pointer-events:none, z-index tinggi): radial-gradient var(--smudge)
   dan noise SVG feTurbulence (baseFrequency .85) opacity .07.
5. Teks tema gelap: text-shadow 0 0 6px rgba(255,255,255,.2). Pemisah pakai dashed. Garis total: border-top 4px double.

# Layout

## Kasir (desktop > 1200px)
+-----------+--------------------------------------+--------------------+
| Sidebar   | Header: judul halaman, jam, stempel Kasir, tema          |
| 232px     +--------------------------------------+--------------------+
| nav       | [cari menu]                          | Pesanan #014       |
| kategori  | [kartu][kartu][kartu][kartu]         | tipe, meja, item   |
| terlaris  | [kartu][kartu][kartu][kartu]         | diskon, total      |
| keluar    | (area ini scroll sendiri)            | [      Bayar     ] |
+-----------+--------------------------------------+--------------------+
Panel pesanan 390px. Tinggi aplikasi = tinggi layar; hanya grid menu dan daftar item yang scroll.
Tablet 901 sampai 1200px: sidebar otomatis menciut jadi 76px (ikon + angka). Mobile <= 900px: sidebar jadi drawer
dari kiri (tombol hamburger di header), panel pesanan jadi drawer dari bawah dengan bar total di bawah layar.

## Admin
+-----------+---------------------------------------------+
| Sidebar   | Header: judul halaman, jam, stempel Admin   |
| nav       +---------------------------------------------+
|           | konten halaman: kartu ringkasan, tabel, form|
+-----------+---------------------------------------------+
Konten maksimal 1100px, scroll vertikal. Tabel yang lebar scroll horizontal di dalam wadahnya sendiri.

## Pelanggan (mobile-first, di desktop dipusatkan max-width 520px)
+-------------------------------+
| Warung Kapur        [Meja 4]  |
| [cari menu]                   |
| (Semua)(Kopi)(Non-kopi)...    |   sticky, scroll horizontal
| [foto] Nama menu   [Tambah]   |
| [foto] Nama menu   [-] 2 [+]  |
+-------------------------------+
| 3 item, Rp 74.000 [Lihat pesanan]   bar tetap di bawah

Semua halaman: viewport-fit=cover dan padding env(safe-area-inset-*).

# Sidebar (komponen Sidebar.tsx dipakai Kasir dan Admin, isinya berbeda)

## Sidebar Kasir
1. Brand kecil (logo coretan + "Warung Kapur").
2. Navigasi: "Kasir", "Pesanan masuk" (dengan lencana jumlah pesanan berstatus baru; lencana beranimasi pop satu kali saat bertambah),
   "Riwayat hari ini".
3. Daftar kategori: Semua + tiap kategori, masing-masing dengan jumlah menu. Kategori aktif = baris putih penuh (teks --board).
   Memilih kategori memfilter grid menu. Dipakai hanya di halaman Kasir.
4. "Menu terlaris hari ini": 5 menu teratas berupa baris kecil (foto mini 40px, nama, tombol +). Ketuk = tambah ke pesanan.
5. Tombol "Atur stok": mengaktifkan mode di mana mengetuk kartu menu menandai habis/tersedia (kasir TIDAK boleh mengubah nama, harga, foto).
6. Bawah: nama kasir dan tombol "Keluar".
Tombol "Ciutkan" mengubah sidebar jadi 76px (hanya ikon dan lencana). Status ciut disimpan di localStorage.

## Sidebar Admin
Navigasi: Ringkasan, Menu, Kategori, Meja dan QR, Laporan, Pengaturan. Bawah: nama admin, "Keluar".
Admin tidak punya daftar kategori atau panel pesanan di sidebar.

# Komponen bersama (src/components/ui)
Shell (frame + grid area), Sidebar, Header, Button (varian: biasa, fill, small, link), Modal, Toast, Chip, StatusChip,
Field (input/select berbingkai kapur), Stepper (minus/jumlah/plus), PhotoBox (foto 4:3 bingkai kapur atau placeholder),
MoneyText, EmptyState, ChalkFilters.
Role berbeda hanya mengganti isi Sidebar, stempel Header, dan gaya bingkai. Jangan menulis ulang komponen per peran.

## PhotoBox / kartu menu
- Foto rasio 4:3, bingkai kapur (::after dengan filter rough). Default hitam putih: grayscale(1) contrast(1.1) brightness(.92).
  Tombol "Foto berwarna" / "Foto hitam putih" di header menggantinya (atribut data-photo di <html>), disimpan di localStorage.
- Tanpa foto: ikon coretan kapur sesuai kategori dan teks "Belum ada foto".
- Menu habis: kartu disabled, nama dicoret bergelombang, tulisan "Habis" menggantikan harga, border dashed.
- Sudah ada di pesanan: lingkaran putih di pojok kanan atas berisi jumlah, animasi pop singkat.
- Grid: repeat(auto-fill, minmax(176px,1fr)), gap 18px. Hover rotate(-.7deg), active scale(.97).

## StatusChip (tanpa warna, dibedakan lewat garis dan isi)
baru = garis tunggal | diterima = garis ganda | diproses = garis dashed | siap = putih penuh |
selesai = garis tunggal dengan teks dicoret | ditolak = dashed dengan teks dicoret.

# Alur pelanggan via QR meja

1. Pelanggan scan QR di meja. QR berisi URL: {origin}/m/{nomorMeja}?t={token}.
   Token meja dibuat acak di halaman Admin. Token salah atau tidak ada: tampilkan "Kode meja tidak dikenali. Minta bantuan staf." tanpa menu.
2. Halaman menu: header (nama warung, stempel "Meja N"), pencarian, chip kategori sticky yang scroll horizontal,
   daftar menu berbentuk baris (foto kiri 96px, nama, harga, tombol "Tambah" yang berubah jadi Stepper setelah ditambah).
   Menu habis tampil disabled. Bar bawah: jumlah item, total (sudah termasuk PPN), tombol "Lihat pesanan".
3. Sheet pesanan (naik dari bawah): daftar item, tiap item punya kolom catatan opsional (mis. "tanpa gula"),
   kolom "Nama pemesan" (opsional), ringkasan (subtotal, PPN, total), pilihan "Bayar di kasir" atau "Bayar dengan QRIS".
   Tombol "Kirim pesanan". Pesanan kosong: tombol disabled.
   Kalau QRIS: setelah kirim, tampilkan QR contoh dan petunjuk; status pembayaran "Menunggu verifikasi kasir".
4. Halaman status (/m/:meja/status): nomor pesanan, daftar item, dan penanda tahap berurutan yang digambar kapur:
   Diterima, Dibuat, Siap diantar, Selesai (tahap saat ini diisi putih, tahap lewat dicoret kapur). Berubah otomatis saat kasir mengubah status.
   Pesanan ditolak: tampilkan alasan dari kasir. Tombol "Tambah pesanan" kembali ke menu (sesi meja yang sama).
5. Pelanggan tidak bisa melihat pesanan meja lain. Pelanggan tidak punya akses ke /kasir dan /admin.

# Pesanan masuk (halaman kasir, /kasir/pesanan-masuk)
- Daftar kartu pesanan dari QR, terbaru di atas, filter chip: Semua, Baru, Diproses, Siap, Selesai.
- Kartu: nomor pesanan, nomor meja, "x menit lalu", ringkasan item (maks 3 baris + "dan n lainnya"), catatan item, total,
  StatusChip untuk status, StatusChip kedua untuk pembayaran (belum bayar / lunas).
- Tombol aksi sesuai status: baru -> "Terima" atau "Tolak" (Tolak meminta alasan singkat);
  diterima -> "Mulai dibuat"; diproses -> "Tandai siap"; siap -> "Selesaikan".
  "Selesaikan" hanya aktif jika pembayaran lunas. Jika belum, tombol "Bayar" membuka PayModal dengan total pesanan itu.
- Pesanan QRIS: tombol "Tandai lunas" (simulasi verifikasi).
- Pesanan baru masuk: toast "Pesanan baru dari Meja 4" dan lencana sidebar bertambah.
- Pesanan dari kasir sendiri (walk-in) langsung berstatus diterima dan masuk ke Riwayat setelah dibayar.

# Halaman Admin
- Ringkasan: kartu angka (penjualan hari ini, jumlah transaksi, rata-rata per transaksi, pesanan QR hari ini),
  grafik batang 7 hari terakhir dan daftar 5 menu terlaris. Grafik dibuat dengan SVG sendiri memakai filter rough. TANPA library chart.
- Menu: tabel (foto mini, nama, kategori, harga, ketersediaan, aksi Ubah/Hapus) dan tombol "Tambah menu".
  Dialog ubah: foto (upload), nama, harga, kategori, "Tandai habis". "Hapus menu" butuh klik dua kali ("Yakin hapus?").
  Upload foto: kecilkan lewat canvas (sisi terpanjang maks 640px), JPEG 0.8, simpan sebagai data URL.
  Penyimpanan penuh: toast "Memori peramban penuh, perubahan belum tersimpan permanen".
- Kategori: daftar kategori dengan Ubah nama, tombol naik/turun untuk urutan (tanpa drag), Hapus (hanya jika tidak ada menu di dalamnya).
  Urutan di sini menentukan urutan di sidebar kasir dan chip pelanggan.
- Meja dan QR: daftar meja (tambah/hapus), tiap meja menampilkan QR asli (library qrcode) dalam bingkai kapur, URL, tombol "Salin tautan",
  "Buat ulang token", dan "Cetak kartu meja". Stylesheet @media print: kartu meja hitam di atas putih, isi: "Warung Kapur", QR besar,
  "Meja N", "Pindai untuk memesan". Satu kartu per sisi halaman A6.
- Laporan: filter tanggal (hari ini, 7 hari, 30 hari, rentang), tabel transaksi (nomor, waktu, sumber kasir/QR, meja, metode, total),
  ringkasan di atas tabel, tombol "Unduh CSV".
- Pengaturan: nama warung, persen PPN (default 11), preset diskon (default 0, 5, 10), PIN kasir dan PIN admin.

# Login
- /login: pilih "Kasir" atau "Admin", lalu keypad PIN gaya kapur. PIN awal: kasir 1234, admin 9999 (bisa diubah di Pengaturan).
- Salah PIN: "PIN salah. Coba lagi." Sesi di sessionStorage. Kasir tidak bisa membuka /admin, admin boleh membuka /kasir.
- Rute /m/* publik. Tidak ada tautan ke /login, /kasir, /admin di tampilan pelanggan.

# Data
type Category = { id: number; name: string; order: number }
type Product = { id: number; name: string; price: number; categoryId: number; soldOut?: boolean; image?: string }
type Table = { id: number; number: number; token: string }
type OrderLine = { productId: number; name: string; price: number; qty: number; note?: string }   // nama dan harga disalin saat pesan
type OrderStatus = 'baru' | 'diterima' | 'diproses' | 'siap' | 'selesai' | 'ditolak'
type Order = {
  id: number; number: number; source: 'kasir' | 'qr'; type: 'dine' | 'take'; tableNo?: number; customerName?: string
  lines: OrderLine[]; subtotal: number; discount: number; tax: number; total: number
  status: OrderStatus; rejectReason?: string
  payment: { status: 'belum' | 'lunas'; method?: 'tunai' | 'qris' | 'kartu'; received?: number; paidAt?: string; qrisPending?: boolean }
  createdAt: string
}
type Settings = { storeName: string; taxPct: number; discountPresets: number[]; pinKasir: string; pinAdmin: string }

Data awal: 4 kategori (Kopi, Non-kopi, Makanan, Camilan) dan 16 menu:
Kopi: Kopi susu gula aren 22000, Americano 18000, Latte 25000, Kopi tubruk 12000
Non-kopi: Es teh manis 8000, Matcha latte 27000 (habis), Coklat dingin 22000, Jeruk peras 15000
Makanan: Nasi goreng kampung 28000, Mie goreng telur 24000, Soto ayam 26000, Roti bakar coklat keju 18000
Camilan: Pisang goreng 12000, Kentang goreng 16000, Tahu crispy 14000, Cireng rujak 13000
12 meja dengan token acak. Riwayat demo 7 hari (sekitar 15 sampai 25 pesanan per hari) dibuat deterministik di data/seed.ts
agar grafik admin terisi. Nomor pesanan berikutnya mulai dari 14 untuk hari ini.

# Aturan hitung (pisahkan di src/lib/money.ts)
subtotal  = jumlah (harga x qty)
diskon    = Math.round(subtotal x persenDiskon / 100)
ppn       = Math.round((subtotal - diskon) x taxPct / 100)
total     = subtotal - diskon + ppn
kembalian = uangDiterima - total
Format: "Rp " + angka dengan titik ribuan. Pesanan dari QR tidak memakai diskon (diskon hanya bisa diberikan kasir).

# Sinkronisasi antar tab (src/lib/bus.ts)
Tanpa backend, tab Pelanggan, Kasir, dan Admin yang dibuka di peramban yang sama harus saling sinkron:
- Satu kunci localStorage 'wk-state-v1' berisi categories, products, tables, orders, settings.
- Setiap perubahan state ditulis ke localStorage dan disiarkan lewat BroadcastChannel('wk').
  Tab lain mendengarkan BroadcastChannel dan event 'storage', lalu memperbarui store.
- Strategi konflik: last-write-wins per irisan state.
- Tambahkan komentar di kode: untuk produksi, bus ini diganti API + WebSocket/SSE supaya HP pelanggan benar-benar terhubung ke kasir.

# Teks antarmuka
- Bahasa Indonesia, kalimat biasa (bukan huruf kapital semua), tanpa tanda panah di tombol.
- Nama aksi konsisten di seluruh aplikasi: "Bayar", "Selesai", "Batal", "Simpan", "Terima", "Tolak", "Kirim pesanan", "Pesanan baru".
- Kondisi kosong dan error memberi arahan jelas, tanpa permintaan maaf. Contoh: "Belum ada pesanan masuk. Pesanan dari QR meja akan muncul di sini."
- Jangan menambah label kecil di atas judul hanya sebagai hiasan.

# Kualitas
- Semua target sentuh minimal 44px. Pelanggan memakai HP satu tangan, jadi tombol utama di zona jempol (bawah layar).
- Fokus keyboard terlihat: outline 2px dashed var(--chalk), offset 4px.
- Tombol ikon punya aria-label. Modal dan sheet punya role="dialog" dan aria-modal="true". Escape menutup modal dan drawer.
- Hormati prefers-reduced-motion. Gerak hanya sebagai respons aksi pengguna.
- Berfungsi dari lebar 360px sampai 1440px, tanpa scroll horizontal pada halaman.
- Teks hasil input pengguna (nama menu, nama pemesan, catatan) dibersihkan dari < > & " ' ` sebelum disimpan atau dirender.

# Struktur file
src/
  main.tsx, App.tsx, routes.tsx
  styles/tokens.css, chalk.css, layout.css, print.css
  lib/money.ts, bus.ts, storage.ts, image.ts, qr.ts, csv.ts, time.ts
  data/seed.ts
  state/store.tsx            (useReducer + Context + persist + bus)
  components/ui/...          (komponen bersama di atas)
  features/auth/Login.tsx, RoleGuard.tsx
  features/kasir/KasirPage.tsx, MenuGrid.tsx, OrderPanel.tsx, PayModal.tsx, Receipt.tsx, IncomingOrders.tsx, History.tsx, KasirSidebar.tsx
  features/admin/Overview.tsx, MenuAdmin.tsx, ProductEditor.tsx, CategoryAdmin.tsx, TablesQr.tsx, Reports.tsx, SettingsPage.tsx, AdminSidebar.tsx
  features/customer/CustomerMenu.tsx, CartSheet.tsx, OrderStatus.tsx

# Cara kerja (WAJIB bertahap)
Tahap 1  Fondasi: setup Vite, tokens, filter kapur, komponen ui, Shell/Sidebar/Header, routing, login PIN, store + bus, seed. `npm run build`.
Tahap 2  Kasir: KasirSidebar (nav, kategori, terlaris, atur stok, ciutkan), MenuGrid, OrderPanel, diskon, PayModal, Receipt, Riwayat, drawer mobile. `npm run build`.
Tahap 3  Pelanggan dan pesanan masuk: halaman /m/:meja, CartSheet, OrderStatus, IncomingOrders dengan alur status. Uji sinkron dua tab. `npm run build`.
Tahap 4  Admin: Ringkasan, Menu, Kategori, Meja dan QR (cetak), Laporan (CSV), Pengaturan. `npm run build`.
Tahap 5  Poles: aksesibilitas, responsif 360 sampai 1440px, print.css, README (cara menjalankan, PIN awal, struktur folder, batasan prototype).
Setelah tiap tahap, build harus bersih dari error dan warning TypeScript sebelum lanjut. Jangan mengerjakan tahap berikutnya sebelum diminta.

# Larangan
- Tidak ada warna selain hitam, putih, dan abu-abu dari variabel.
- Tidak ada library selain react-router-dom dan qrcode. Tidak ada library chart, ikon, animasi, atau state management.
- Jangan akses localStorage/sessionStorage tanpa try/catch.
- Jangan mengubah nama token, nama file, rute, atau struktur folder di atas. Jangan mengubah aturan hitung.
- Jangan menduplikasi komponen per peran. Perbedaan peran hanya di Sidebar, stempel Header, bingkai, dan isi halaman.

# Kriteria selesai
[ ] Tema gelap/terang dan mode foto jalan, pilihan tersimpan
[ ] Login PIN berjalan, kasir tidak bisa membuka /admin, rute /m/* publik
[ ] Sidebar kasir: pilih kategori memfilter menu, menu terlaris menambah ke pesanan, bisa diciutkan, jadi drawer di mobile
[ ] Hitungan subtotal, diskon, PPN, total, dan kembalian benar; bayar tunai/QRIS/kartu selesai; struk tampil
[ ] Scan/buka /m/4?t=TOKEN: pelanggan memesan dengan catatan, pesanan muncul di Pesanan masuk kasir di tab lain tanpa refresh
[ ] Kasir mengubah status, halaman status pelanggan ikut berubah; pesanan ditolak menampilkan alasan
[ ] Token salah menampilkan "Kode meja tidak dikenali"
[ ] Admin: tambah/ubah/hapus menu dan kategori, upload foto, QR meja asli bisa di-scan dan bisa dicetak, laporan dan CSV jalan
[ ] Tampilan 360px: bar bawah pelanggan, drawer pesanan kasir, dan sidebar drawer berfungsi
[ ] npm run build sukses