// features/admin/KategoriPage.tsx — CRUD kategori + reorder
import { useState } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field } from "../../components/ui/Field";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { escapeHtml } from "../../lib/csv";
import type { Category } from "../../data/seed";

export function KategoriPage() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const sorted = [...state.categories].sort((a, b) => a.order - b.order);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Nama kategori wajib diisi"); return; }
    if (state.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) { toast("Kategori sudah ada"); return; }
    const maxOrder = Math.max(-1, ...state.categories.map((c) => c.order));
    const maxId = Math.max(0, ...state.categories.map((c) => c.id));
    dispatch({ type: "ADD_CATEGORY", payload: { id: maxId + 1, name: escapeHtml(trimmed), order: maxOrder + 1 } });
    setName("");
    toast("Kategori ditambahkan");
  }

  function saveEdit() {
    if (!editTarget) return;
    const trimmed = editTarget.name.trim();
    if (!trimmed) { toast("Nama kategori wajib diisi"); return; }
    dispatch({ type: "UPDATE_CATEGORY", payload: { id: editTarget.id, patch: { name: trimmed } } });
    toast("Kategori diperbarui");
    setEditTarget(null);
  }

  function remove() {
    if (!deleteTarget) return;
    const used = state.products.filter((p) => p.categoryId === deleteTarget.id).length;
    if (used > 0) {
      toast(`Masih ada ${used} menu di kategori ini`);
      setDeleteTarget(null);
      return;
    }
    dispatch({ type: "DELETE_CATEGORY", payload: deleteTarget.id });
    toast("Kategori dihapus");
    setDeleteTarget(null);
  }

  return (
    <Shell role="admin" title="Kategori" sidebarContent={<AdminSidebar />}>
      <div className="inner">
        <div className="addrow">
          <label className="fld box r3">
            <input
              type="text"
              maxLength={24}
              placeholder="Nama kategori baru"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </label>
          <Button active onClick={add}>Tambah kategori</Button>
        </div>
        <p className="hint">Urutan di sini menentukan urutan di sidebar kasir dan chip pelanggan.</p>

        {sorted.map((cat, idx) => {
          const count = state.products.filter((p) => p.categoryId === cat.id).length;
          return (
            <div key={cat.id} className="catrow">
              <span className="nm">
                <span>{cat.name}</span>
                <span className="dim">{count} menu</span>
              </span>
              <Button
                variant="small"
                onClick={() => dispatch({ type: "REORDER_CATEGORY", payload: { id: cat.id, dir: -1 } })}
                disabled={idx === 0}
                aria-label={`Naikkan ${cat.name}`}
              >
                Naik
              </Button>
              <Button
                variant="small"
                radius="r2"
                onClick={() => dispatch({ type: "REORDER_CATEGORY", payload: { id: cat.id, dir: 1 } })}
                disabled={idx === sorted.length - 1}
                aria-label={`Turunkan ${cat.name}`}
              >
                Turun
              </Button>
              <Button variant="small" radius="r3" onClick={() => setEditTarget({ ...cat })}>Ubah nama</Button>
              <Button
                variant="small"
                onClick={() => setDeleteTarget(cat)}
                disabled={count > 0}
                title={count > 0 ? "Pindahkan atau hapus menu di kategori ini dulu" : undefined}
              >
                Hapus
              </Button>
            </div>
          );
        })}
      </div>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Ubah nama kategori">
        {editTarget && (
          <>
            <Field
              label="Nama kategori"
              value={editTarget.name}
              onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
              maxLength={24}
              autoFocus
            />
            <div className="actions">
              <Button onClick={() => setEditTarget(null)}>Batal</Button>
              <Button variant="fill" onClick={saveEdit}>Simpan</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus kategori?">
        <p className="hint">{deleteTarget?.name}</p>
        <div className="actions">
          <Button onClick={() => setDeleteTarget(null)}>Batal</Button>
          <Button variant="fill" onClick={remove}>Hapus</Button>
        </div>
      </Modal>
    </Shell>
  );
}
