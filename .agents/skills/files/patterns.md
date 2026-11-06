# Pola dan contoh: offline sync dan idempotensi

Daftar isi
1. Skema server
2. Handler idempoten di server
3. Outbox dan sync loop di klien
4. Penyesuaian per database
5. Skenario tes wajib
6. Checklist review

Semua contoh bersifat ilustrasi. Sesuaikan sintaks, penamaan, dan library dengan stack project. Pertahankan prinsip, bukan teks persisnya.

---

## 1. Skema server

Contoh bergaya PostgreSQL. Setiap tabel data tenant memuat `tenant_id`.

```sql
-- Catatan idempotensi. Hanya ditulis di dalam transaksi yang sama dengan efek bisnisnya.
CREATE TABLE idempotency_keys (
  tenant_id       uuid        NOT NULL,
  key             text        NOT NULL,
  request_hash    text        NOT NULL,
  response_status int         NOT NULL,
  response_body   jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);
CREATE INDEX idx_idem_created ON idempotency_keys (created_at);  -- untuk pembersihan sesuai TTL

-- Perangkat dan urutannya.
CREATE TABLE devices (
  tenant_id      uuid   NOT NULL,
  device_id      uuid   NOT NULL,
  last_seq_acked bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, device_id)
);

-- Penjualan. Uang dalam integer satuan terkecil.
CREATE TABLE orders (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid        NOT NULL,
  client_op_id       uuid        NOT NULL,
  device_id          uuid        NOT NULL,
  device_seq         bigint      NOT NULL,
  local_number       text        NOT NULL,     -- dicetak di struk offline
  official_number    text,                     -- diberi server saat sync
  total_amount       bigint      NOT NULL,
  status             text        NOT NULL,
  client_created_at  timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_op_id),
  UNIQUE (tenant_id, device_id, device_seq)
);

-- Pergerakan stok: append-only. Tidak ada UPDATE atau DELETE.
CREATE TABLE stock_movements (
  id           uuid PRIMARY KEY,
  tenant_id    uuid   NOT NULL,
  outlet_id    uuid   NOT NULL,
  product_id   uuid   NOT NULL,
  delta        int    NOT NULL,                -- negatif = keluar
  reason       text   NOT NULL,                -- sale, adjustment, return, ...
  ref_type     text   NOT NULL,
  ref_id       uuid   NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ref_type, ref_id, product_id, reason)
);

-- Penanda rekonsiliasi untuk konflik yang diterima dengan penyesuaian.
CREATE TABLE sync_flags (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  kind       text NOT NULL,                    -- negative_stock, price_mismatch, ...
  ref_type   text NOT NULL,
  ref_id     uuid NOT NULL,
  details    jsonb NOT NULL,
  status     text NOT NULL DEFAULT 'open',     -- open, resolved
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Catatan desain:
- `UNIQUE (tenant_id, client_op_id)` pada `orders` adalah lapis pengaman kedua. Jika catatan idempotensi hilang (pembersihan, bug), duplikat tetap tertolak di tingkat data.
- `UNIQUE` pada `stock_movements` mencegah pergerakan yang sama tertulis dua kali walau handler dijalankan ulang.
- Audit log (siapa, kapan, aksi, nilai lama, nilai baru, tenant_id) ditulis dalam transaksi yang sama. Skemanya mengikuti skill `pos-domain`.

---

## 2. Handler idempoten di server

Pseudocode bergaya TypeScript.

```ts
async function handleMutation(ctx, key, payload, work) {
  const hash = sha256(canonicalJson(payload)); // urutkan key JSON agar stabil

  return db.transaction(async (tx) => {
    // Pada PostgreSQL, INSERT ... ON CONFLICT menunggu transaksi lain yang memegang
    // key yang sama sampai commit atau rollback. Maka request kembar bersamaan
    // tidak pernah menjalankan `work` dua kali.
    const inserted = await tx.tryInsertKey(ctx.tenantId, key, hash);

    if (!inserted) {
      const row = await tx.getKey(ctx.tenantId, key);
      if (row.request_hash !== hash) {
        throw new HttpError(422, "Idempotency key dipakai ulang dengan isi berbeda");
      }
      return { status: row.response_status, body: row.response_body, replay: true };
    }

    const result = await work(tx);  // order + pergerakan stok + audit log

    await tx.completeKey(ctx.tenantId, key, result.status, result.body);
    return result;
  });
}
```

Mengapa status `in_progress` tidak perlu: karena catatan key dan efek bisnis berada di satu transaksi, pihak lain tidak pernah melihat key yang setengah jalan. Jika Anda memilih menulis key di transaksi terpisah, Anda wajib menangani status `in_progress` (jawab 409 dengan Retry-After) dan menangani key yang menggantung setelah crash. Desain satu transaksi lebih sederhana dan lebih aman.

### Penerima batch

```ts
async function pushBatch(ctx, deviceId, ops) {
  const results = [];
  for (const op of ops) {                        // berurutan menurut device_seq
    try {
      const r = await handleMutation(ctx, op.opId, op.payload, (tx) => applyOp(tx, ctx, deviceId, op));
      results.push({ opId: op.opId, status: r.replay ? "duplicate" : r.body.outcome, ...r.body });
    } catch (e) {
      if (isPermanent(e)) results.push({ opId: op.opId, status: "rejected", reason: e.message });
      else throw e;                              // error sementara: biarkan klien retry seluruh sisa batch
    }
  }
  return { results };
}
```

`applyOp` memutuskan hasil bisnis: `applied`, atau `adjusted` bila ada konflik yang diterima (mis. stok jadi negatif, buat baris `sync_flags`). Jangan melempar error hanya karena stok negatif untuk penjualan yang sudah terjadi.

Pada webhook gateway, pola yang sama berlaku dengan `event.id` dari gateway sebagai key dan signature divalidasi pada raw body sebelum apa pun diproses.

---

## 3. Outbox dan sync loop di klien

```ts
// Saat kasir menekan "Bayar".
async function submitSale(cart) {
  // Key melekat pada percobaan checkout dan disimpan bersama keranjang.
  cart.checkoutAttemptId ??= uuidv7();

  await localDb.transaction(async (tx) => {
    const seq = await tx.nextDeviceSeq();
    await tx.insert("local_orders", buildLocalOrder(cart, seq));
    await tx.insert("local_stock_movements", buildLocalMovements(cart));
    await tx.insert("outbox", {
      op_id: cart.checkoutAttemptId,
      device_seq: seq,
      type: "sale.create",
      payload: buildPayload(cart),
      status: "pending",
      attempts: 0,
      next_retry_at: now(),
    });
  });

  syncSoon(); // debounce, tidak menunggu hasilnya
}
```

```ts
let running = false;

async function sync() {
  if (running) return;          // single-flight
  running = true;
  try {
    await push();
    await pull();
  } finally {
    running = false;
  }
}

async function push() {
  const batch = await outbox.nextPending({ limit: 50, orderBy: "device_seq" });
  if (batch.length === 0) return;

  let res;
  try {
    res = await api.post("/sync/push", { deviceId, ops: batch });
  } catch (e) {
    if (isTransient(e)) {                         // jaringan, 5xx, 429
      await outbox.scheduleRetry(batch, backoffWithJitter);
      return;
    }
    throw e;
  }

  for (const r of res.results) {
    if (["applied", "duplicate", "adjusted"].includes(r.status)) {
      await outbox.markAcked(r.opId, r);
    } else if (r.status === "rejected") {
      await outbox.quarantine(r.opId, r.reason);  // juga karantina yang depends_on op ini
    }
  }
}

async function pull() {
  const cursor = await localDb.getCursor();
  const { changes, nextCursor } = await api.get("/sync/pull", { cursor });
  await localDb.transaction(async (tx) => {
    await tx.applyChanges(changes);               // termasuk tombstone
    await tx.setCursor(nextCursor);               // cursor dan data satu transaksi
  });
}

function backoffWithJitter(attempts) {
  const base = Math.min(60_000, 1_000 * 2 ** attempts);
  return base / 2 + Math.random() * (base / 2);
}
```

Pemicu `sync()`: event online, app start, app resume, setelah tulis (debounce), dan timer berkala. Karena `running` menjaga single-flight, pemicu ganda aman.

---

## 4. Penyesuaian per database

PostgreSQL: contoh di atas berlaku apa adanya (`INSERT ... ON CONFLICT DO NOTHING`, `SELECT ... FOR UPDATE`).

MySQL/MariaDB:
- Gunakan `INSERT IGNORE` atau `INSERT ... ON DUPLICATE KEY UPDATE` dan periksa jumlah baris yang terpengaruh untuk mengetahui apakah key baru.
- Gunakan transaksi InnoDB. Pastikan tabel `idempotency_keys` memakai `utf8mb4` dan kolom `key` diberi panjang yang wajar (mis. `VARCHAR(64)`).
- Gunakan kolom `JSON` untuk `response_body` bila versi mendukung, jika tidak simpan sebagai `TEXT`.
- Penguncian baris: `SELECT ... FOR UPDATE` untuk pemeriksaan stok.

SQLite (klien atau server tunggal):
- Satu penulis pada satu waktu. Gunakan `BEGIN IMMEDIATE` untuk transaksi tulis agar tidak terjadi deadlock tersembunyi.
- Aktifkan WAL untuk klien yang membaca dan menulis bersamaan.

Dengan ORM (Prisma, Eloquent, Sequelize, dan sebagainya): tangkap error pelanggaran unique constraint dan perlakukan sebagai sinyal "key sudah ada", lalu baca baris yang ada. Pastikan operasi bisnis dan penulisan key berada dalam satu callback transaksi ORM yang sama.

---

## 5. Skenario tes wajib

Tulis tes otomatis untuk setiap baris. Tampilkan output tes yang benar-benar dijalankan.

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Kirim operasi yang sama 2 kali berurutan | Satu order, satu pengurangan stok, respons kedua sama dengan pertama (`duplicate`) |
| 2 | Crash setelah commit server tetapi sebelum respons sampai ke klien, lalu retry | Satu order. Retry mengembalikan hasil yang tersimpan |
| 3 | Dua request dengan key sama dikirim bersamaan | Efek bisnis hanya sekali. Satu `applied`, satu `duplicate` |
| 4 | Key sama dengan isi berbeda | 422, tidak ada efek bisnis baru |
| 5 | Key sama di dua tenant berbeda | Keduanya diproses, tidak saling mengganggu |
| 6 | Penjualan offline membuat stok negatif | Penjualan diterima (`adjusted`), `sync_flags` terbuat, saldo mencerminkan pergerakan |
| 7 | Dua perangkat mengubah harga produk yang sama saat offline | Kebijakan entitas berlaku (versi/server menang), tidak ada data hilang diam-diam, hasil terlihat |
| 8 | Perangkat A menghapus, perangkat B mengedit record yang sama | Sesuai kebijakan, tombstone ter-replikasi ke perangkat lain |
| 9 | Jam perangkat mundur 1 hari | Urutan tetap benar berdasarkan `device_seq`, bukan jam |
| 10 | Antrian 500 operasi menumpuk lalu online | Semua terkirim berurutan, tanpa duplikat, UI menunjukkan progres |
| 11 | Satu operasi dalam batch ditolak permanen | Operasi lain tetap `applied`. Yang ditolak masuk karantina dan terlihat di UI |
| 12 | Event online menembak 5 kali berturut-turut | Hanya satu sync berjalan (single-flight) |
| 13 | Server 503 lalu pulih | Retry dengan backoff dan jitter, tanpa duplikat |
| 14 | Webhook gateway dikirim ulang | Diproses sekali, dedupe dengan event id |
| 15 | Token kedaluwarsa saat offline, login ulang | Antrian utuh dan terkirim, aktor asli tercatat di audit log |
| 16 | Operasi tenant A dimasukkan ke batch perangkat tenant B | Ditolak, tidak ada data bocor |
| 17 | Muat ulang halaman atau restart aplikasi di tengah antrian | Outbox utuh, tidak ada operasi hilang |

---

## 6. Checklist review

Sebelum merge, pastikan:

- [ ] Idempotency key dibuat sekali per aksi dan disimpan sebelum request pertama.
- [ ] Catatan key dan efek bisnis berada dalam satu transaksi.
- [ ] Hash payload diperiksa dan ketidakcocokan menghasilkan 422.
- [ ] TTL key melebihi batas offline terpanjang yang didukung.
- [ ] Ada unique constraint pada data (`client_op_id`) sebagai lapis kedua.
- [ ] Pergerakan stok append-only dan stok negatif akibat penjualan offline ditandai, bukan ditolak.
- [ ] Baris penjualan menyimpan snapshot harga.
- [ ] Urutan memakai `device_seq` dan versi server, bukan jam perangkat.
- [ ] Sync single-flight, retry dengan backoff dan jitter, error permanen masuk karantina.
- [ ] Pull memakai cursor/versi server dan mendukung tombstone.
- [ ] Pembayaran elektronik tidak pernah ditandai lunas dari sisi klien.
- [ ] Setiap operasi dalam batch divalidasi tenant dan izinnya di server.
- [ ] Penyimpanan klien durable, bukan localStorage.
- [ ] Status sync terlihat oleh kasir dan operasi karantina bisa diekspor.
- [ ] Semua tes di bagian 5 ada, dijalankan, dan outputnya ditampilkan.
