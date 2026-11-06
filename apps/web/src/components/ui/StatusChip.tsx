// components/ui/StatusChip.tsx
import type { OrderStatus } from "../../data/seed";

const SLABEL: Record<string, string> = {
  baru: "Baru",
  diterima: "Diterima",
  diproses: "Diproses",
  siap: "Siap",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const cls = `chip s-${status}`;
  return <span className={cls}>{SLABEL[status] || status}</span>;
}

export function PaymentChip({ paid, method }: { paid: boolean; method?: string | null }) {
  if (paid) return <span className="chip p-lunas">Lunas</span>;
  return (
    <span className="chip p-belum">
      {method === "qris" ? "QRIS menunggu verifikasi" : "Belum bayar"}
    </span>
  );
}
