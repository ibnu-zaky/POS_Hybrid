// time.ts — util waktu
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minutesAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "Baru saja";
  if (diff < 60) return `${diff} menit lalu`;
  const h = Math.floor(diff / 60);
  return `${h} jam lalu`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
