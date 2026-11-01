// components/ui/Header.tsx
import { useEffect, useState } from "react";
import { useCurrentDate } from "../../hooks/useCurrentDate";

type Role = "kasir" | "admin" | "pelanggan";

type Props = {
  title: string;
  role: Role;
  onToggleCollapse?: () => void;
};

function getStoredTheme(): "dark" | "light" {
  try {
    const theme = localStorage.getItem("wk-theme");
    return theme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getStoredPhoto(): "bw" | "color" {
  try {
    const photo = localStorage.getItem("wk-photo");
    return photo === "color" ? "color" : "bw";
  } catch {
    return "bw";
  }
}

export function Header({ role, onToggleCollapse }: Props) {
  const now = useCurrentDate();
  const [theme, setTheme] = useState<"dark" | "light">(() => getStoredTheme());
  const [photo, setPhoto] = useState<"bw" | "color">(() => getStoredPhoto());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("wk-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-photo", photo);
    try { localStorage.setItem("wk-photo", photo); } catch { /* ignore */ }
  }, [photo]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function togglePhoto() {
    setPhoto((current) => (current === "bw" ? "color" : "bw"));
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
