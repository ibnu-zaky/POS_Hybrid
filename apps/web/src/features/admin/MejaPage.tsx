// features/admin/MejaPage.tsx — meja + QR code + cetak
import { useState, useEffect } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { generateQR } from "../../lib/qr";
import type { Table } from "../../data/seed";

export function MejaPage() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const [qrMap, setQrMap] = useState<Map<number, string>>(new Map());
  const [addCount, setAddCount] = useState(1);
  const [printTarget, setPrintTarget] = useState<{ table: Table; qr: string } | null>(null);

  const sorted = [...state.tables].sort((a, b) => a.number - b.number);

  useEffect(() => {
    let cancelled = false;
    async function gen() {
      const map = new Map<number, string>();
      for (const t of sorted) {
        const url = `${window.location.origin}/m/${t.number}?t=${t.token}`;
        const dataUrl = await generateQR(url);
        map.set(t.id, dataUrl);
      }
      if (!cancelled) setQrMap(map);
    }
    gen();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tables]);

  function regenerate(id: number) {
    dispatch({ type: "REGENERATE_TOKEN", payload: id });
    toast("Token meja digenerate ulang. Cetak ulang QR meja ini.");
  }

  async function copyLink(t: Table) {
    const url = `${window.location.origin}/m/${t.number}?t=${t.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Tautan disalin");
    } catch {
      toast("Gagal menyalin tautan");
    }
  }

  function addTables() {
    const maxNumber = Math.max(0, ...state.tables.map((t) => t.number));
    const maxId = Math.max(0, ...state.tables.map((t) => t.id));
    for (let i = 1; i <= addCount; i++) {
      const number = maxNumber + i;
      const token = Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
      dispatch({ type: "ADD_TABLE", payload: { id: maxId + i, number, token } });
    }
    toast(`${addCount} meja ditambahkan`);
  }

  function removeTable(id: number) {
    dispatch({ type: "DELETE_TABLE", payload: id });
    toast("Meja dihapus");
  }

  function openPrint(t: Table) {
    const qr = qrMap.get(t.id);
    if (!qr) return;
    setPrintTarget({ table: t, qr });
  }

  return (
    <Shell role="admin" title="Meja dan QR" sidebarContent={<AdminSidebar />}>
      <div className="inner">
        <div className="pagehead">
          <h2>Meja dan kode QR</h2>
          <span className="sp" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="dim">Tambah meja:</span>
            <input
              type="number"
              min={1}
              max={20}
              value={addCount}
              onChange={(e) => setAddCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              style={{ width: 80 }}
            />
            <Button radius="r2" onClick={addTables}>Tambah</Button>
          </div>
          <Button variant="fill" onClick={() => sorted[0] && openPrint(sorted[0])}>Cetak kartu meja</Button>
        </div>
        <p className="hint">Tempel kartu QR di setiap meja. Pelanggan memindai dengan kamera HP lalu langsung melihat menu.</p>

        <div className="tgrid">
          {sorted.map((t, i) => {
            const qr = qrMap.get(t.id);
            const url = `${window.location.origin}/m/${t.number}?t=${t.token}`;
            return (
              <div key={t.id} className={`tcard box ${i % 2 ? "r2" : "r3"}`}>
                <h3>Meja {t.number}</h3>
                <div className="qrbox box">
                  {qr ? (
                    <img src={qr} alt={`QR Meja ${t.number}`} className="qr" style={{ width: 150, height: 150 }} />
                  ) : (
                    <div style={{ width: 150, height: 150, color: "var(--dim)", display: "grid", placeItems: "center" }}>
                      Memuat...
                    </div>
                  )}
                </div>
                <div className="url">{url}</div>
                <div className="acts">
                  <Button variant="small" onClick={() => window.open(url, "_blank")}>Buka sebagai pelanggan</Button>
                  <Button variant="small" radius="r2" onClick={() => copyLink(t)}>Salin tautan</Button>
                  <Button variant="small" radius="r3" onClick={() => regenerate(t.id)}>Buat ulang token</Button>
                  <Button variant="small" onClick={() => removeTable(t.id)}>Hapus</Button>
                </div>
              </div>
            );
          })}
        </div>

        {sorted.length === 0 && <p className="hint">Belum ada meja.</p>}
      </div>

      <Modal open={!!printTarget} onClose={() => setPrintTarget(null)} title="Kartu meja">
        {printTarget && (
          <>
            <div className="print-cards" id="pc">
              <section className="pcard">
                <h2>{state.settings.storeName}</h2>
                <img src={printTarget.qr} alt="" className="qr" />
                <h3>Meja {printTarget.table.number}</h3>
                <p>Pindai untuk memesan</p>
              </section>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div
                className="print-card"
                style={{
                  border: "2px solid var(--chalk)",
                  width: "105mm",
                  height: "148mm",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 20 }}>{state.settings.storeName}</div>
                <img src={printTarget.qr} alt="" style={{ width: "70mm", height: "70mm" }} />
                <div style={{ fontSize: 28, fontFamily: "var(--font-title)" }}>Meja {printTarget.table.number}</div>
                <div style={{ fontSize: 16 }}>Pindai untuk memesan</div>
              </div>
              <Button variant="fill" onClick={() => window.print()}>Cetak</Button>
            </div>
          </>
        )}
      </Modal>
    </Shell>
  );
}
