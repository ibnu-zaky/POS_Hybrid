// features/admin/PengaturanPage.tsx — pengaturan umum
import { useState } from "react";
import { Shell } from "../../components/ui/Shell";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useStore } from "../../state/store-context";
import { useToast } from "../../components/ui/toast-context";
import { escapeHtml } from "../../lib/csv";

export function PengaturanPage() {
  const { state, dispatch } = useStore();
  const { toast } = useToast();
  const [storeName, setStoreName] = useState(state.settings.storeName);
  const [taxPct, setTaxPct] = useState(state.settings.taxPct);
  const [pinKasir, setPinKasir] = useState(state.settings.pinKasir);
  const [pinAdmin, setPinAdmin] = useState(state.settings.pinAdmin);
  const [discountPresets, setDiscountPresets] = useState(state.settings.discountPresets.join(", "));

  function save() {
    if (!storeName.trim()) { toast("Nama warung wajib diisi"); return; }
    if (taxPct < 0 || taxPct > 30) { toast("PPN harus antara 0 sampai 30"); return; }
    if (pinKasir.length < 4 || pinAdmin.length < 4) { toast("PIN minimal 4 angka"); return; }

    const presets = discountPresets
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 100);

    dispatch({
      type: "UPDATE_SETTINGS",
      payload: {
        storeName: escapeHtml(storeName.trim()),
        taxPct,
        pinKasir,
        pinAdmin,
        discountPresets: presets.length > 0 ? presets : [0, 5, 10],
      },
    });
    toast("Pengaturan disimpan");
  }

  return (
    <Shell role="admin" title="Pengaturan" sidebarContent={<AdminSidebar />}>
      <div className="inner" style={{ maxWidth: 640 }}>
        <div className="panel box r2">
          <div className="formgrid">
            <Field
              label="Nama warung"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={30}
            />
            <Field
              label="PPN (persen)"
              type="number"
              min={0}
              max={30}
              inputMode="numeric"
              value={taxPct}
              onChange={(e) => setTaxPct(parseInt(e.target.value) || 0)}
            />
            <Field
              label="Preset diskon (pisahkan koma)"
              value={discountPresets}
              onChange={(e) => setDiscountPresets(e.target.value)}
              placeholder="0, 5, 10"
            />
            <span />
            <Field
              label="PIN kasir"
              type="text"
              inputMode="numeric"
              value={pinKasir}
              onChange={(e) => setPinKasir(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
            />
            <Field
              label="PIN admin"
              type="text"
              inputMode="numeric"
              value={pinAdmin}
              onChange={(e) => setPinAdmin(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
            />
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <Button variant="fill" onClick={save}>Simpan</Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
