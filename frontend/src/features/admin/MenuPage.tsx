// features/admin/MenuPage.tsx — CRUD menu + foto (tabel ala referensi)
import { useState } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Field, SelectField } from "../../components/ui/Field";
import { PhotoBox } from "../../components/ui/PhotoBox";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { formatRp } from "../../lib/money";
import { resizeImage } from "../../lib/image";
import { escapeHtml } from "../../lib/csv";
import type { Product } from "../../data/seed";

type EditState = {
  id?: number;
  name: string;
  price: number;
  categoryId: number;
  soldOut: boolean;
  image?: string;
};

export function MenuPage() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  function openNew() {
    setEdit({
      name: "",
      price: 0,
      categoryId: state.categories[0]?.id || 1,
      soldOut: false,
    });
  }

  function openEdit(p: Product) {
    setEdit({ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId, soldOut: p.soldOut ?? false, image: p.image });
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setEdit((prev) => (prev ? { ...prev, image: dataUrl } : prev));
    } catch {
      toast("Gagal memproses foto");
    }
  }

  function save() {
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) {
      toast("Nama menu wajib diisi");
      return;
    }
    if (edit.price < 0) {
      toast("Harga tidak boleh negatif");
      return;
    }
    const safeName = escapeHtml(name);

    if (edit.id) {
      dispatch({
        type: "UPDATE_PRODUCT",
        payload: {
          id: edit.id,
          patch: { name: safeName, price: edit.price, categoryId: edit.categoryId, soldOut: edit.soldOut, image: edit.image },
        },
      });
      toast("Menu diperbarui");
    } else {
      const maxId = Math.max(0, ...state.products.map((p) => p.id));
      dispatch({
        type: "ADD_PRODUCT",
        payload: { id: maxId + 1, name: safeName, price: edit.price, categoryId: edit.categoryId, soldOut: edit.soldOut, image: edit.image },
      });
      toast("Menu ditambahkan");
    }
    setEdit(null);
  }

  function remove() {
    if (!deleteTarget) return;
    dispatch({ type: "DELETE_PRODUCT", payload: deleteTarget.id });
    toast("Menu dihapus");
    setDeleteTarget(null);
  }

  const products = [...state.products].sort((a, b) => a.id - b.id);

  return (
    <Shell role="admin" title="Menu" sidebarContent={<AdminSidebar />}>
      <div className="inner">
        <div className="pagehead">
          <h2>Daftar menu</h2>
          <span className="sp" />
          <Button variant="fill" onClick={openNew}>Tambah menu</Button>
        </div>

        {products.length === 0 ? (
          <p className="hint">Belum ada menu.</p>
        ) : (
          <div className="tw">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th className="r">Harga</th>
                  <th>Stok</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const category = state.categories.find((c) => c.id === p.categoryId);
                  return (
                    <tr key={p.id}>
                      <td>
                        <PhotoBox src={p.image} alt={p.name} className="th" />
                      </td>
                      <td>{escapeHtml(p.name)}</td>
                      <td>{category?.name || "-"}</td>
                      <td className="r">{formatRp(p.price)}</td>
                      <td>
                        {p.soldOut ? (
                          <span className="chip s-ditolak">Habis</span>
                        ) : (
                          <span className="chip">Tersedia</span>
                        )}
                      </td>
                      <td className="r">
                        <div className="acts">
                          <Button variant="small" radius="r2" onClick={() => openEdit(p)}>Ubah</Button>
                          <Button variant="small" radius="r3" onClick={() => setDeleteTarget(p)}>Hapus</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah menu" : "Tambah menu"}>
        {edit && (
          <>
            <div className="editpic">
              {edit.image ? (
                <span className="photo">
                  <img src={edit.image} alt="Foto menu" />
                </span>
              ) : (
                <span className="photo none">
                  <svg className="ic" viewBox="0 0 64 64" aria-hidden="true">
                    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 32L32 8h22v22L30 54z" />
                      <circle cx="44" cy="20" r="3" />
                    </g>
                  </svg>
                  <small>Belum ada foto</small>
                </span>
              )}
              <div className="picbtns">
                <label className="btn small box r2" htmlFor="photoIn">
                  {edit.image ? "Ganti foto" : "Pilih foto"}
                </label>
                <input type="file" id="photoIn" accept="image/*" hidden onChange={handleImage} />
                {edit.image && (
                  <Button variant="small" radius="r3" onClick={() => setEdit({ ...edit, image: undefined })}>
                    Hapus foto
                  </Button>
                )}
                <p className="hint">Foto otomatis dikecilkan agar hemat memori.</p>
              </div>
            </div>

            <Field
              label="Nama menu"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              maxLength={40}
              placeholder="Contoh: Nasi goreng"
              autoFocus
            />
            <div className="formgrid">
              <Field
                label="Harga (Rp)"
                type="number"
                min={0}
                step={500}
                value={edit.price}
                onChange={(e) => setEdit({ ...edit, price: parseInt(e.target.value) || 0 })}
              />
              <SelectField
                label="Kategori"
                value={edit.categoryId}
                onChange={(e) => setEdit({ ...edit, categoryId: parseInt(e.target.value) })}
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={edit.soldOut}
                onChange={(e) => setEdit({ ...edit, soldOut: e.target.checked })}
              />{" "}
              Tandai habis
            </label>

            <div className="actions">
              <Button onClick={() => setEdit(null)}>Batal</Button>
              <Button variant="fill" onClick={save}>Simpan</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus menu?">
        <p className="hint">{deleteTarget?.name}</p>
        <div className="actions">
          <Button onClick={() => setDeleteTarget(null)}>Batal</Button>
          <Button variant="fill" onClick={remove}>Hapus</Button>
        </div>
      </Modal>
    </Shell>
  );
}
