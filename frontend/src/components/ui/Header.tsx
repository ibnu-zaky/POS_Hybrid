// components/ui/Header.tsx
import { useCurrentDate } from "../../hooks/useCurrentDate";

type Role = "kasir" | "admin" | "pelanggan";

type Props = {
  title: string;
  role: Role;
  onToggleCollapse?: () => void;
};

export function Header({ role, onToggleCollapse }: Props) {
  const now = useCurrentDate();

  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const photo = document.documentElement.getAttribute("data-photo") || "bw";

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("wk-theme", next); } catch { /* ignore */ }
  }

  function togglePhoto() {
    const next = photo === "bw" ? "color" : "bw";
    document.documentElement.setAttribute("data-photo", next);
    try { localStorage.setItem("wk-photo", next); } catch { /* ignore */ }
  }

  return (
    <>
      <span className="clock hidemob">
        {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        {", "}
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className={`stamp box${role === "admin" ? " dbl r3" : " r2"}`} data-role={role}>
        {role === "kasir" ? "Kasir" : role === "admin" ? "Admin" : "Meja"}
      </span>
      {role !== "pelanggan" && (
        <button type="button" className="btn small box r2 hidemob" onClick={togglePhoto} aria-label="Ganti mode foto">
          {photo === "bw" ? "Foto berwarna" : "Foto hitam putih"}
        </button>
      )}
      {role !== "pelanggan" && (
        <button type="button" className="btn small box r3" onClick={toggleTheme} aria-label="Ganti tema">
          {theme === "dark" ? "Whiteboard" : "Papan tulis"}
        </button>
      )}
      {onToggleCollapse && (
        <button type="button" className="btn small box r3 hidemob" onClick={onToggleCollapse} aria-label="Ciutkan sidebar">
          Ciutkan
        </button>
      )}
    </>
  );
}
