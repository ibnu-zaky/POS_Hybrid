// components/ui/Shell.tsx
import { useState, useEffect, type ReactNode } from "react";
import { Header } from "./Header";

type Role = "kasir" | "admin" | "pelanggan";

type Props = {
  role: Role;
  title: string;
  children: ReactNode;
  sidebarContent?: ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** statistik opsional di header (mis. "Hari ini, N transaksi") */
  headerExtra?: ReactNode;
};

export function Shell({ role, title, children, sidebarContent, collapsed, onToggleCollapse, headerExtra }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const frameCls = role === "admin" ? "frame admin" : role === "pelanggan" ? "frame cust" : "frame";
  const shellCls = `shell hs${collapsed ? " col" : ""}`;

  return (
    <div className={frameCls}>
      <div className={shellCls}>
        <aside className={`side${drawerOpen ? " open" : ""}`} id="side">
          {sidebarContent}
        </aside>
        {drawerOpen && <div className="backdrop" onClick={() => setDrawerOpen(false)} />}
        <div className="main">
          <header className="hdr">
            <button
              type="button"
              className="btn small box r2 hamb"
              aria-label="Buka menu samping"
              onClick={() => setDrawerOpen(true)}
            >
              ☰
            </button>
            <h1 className="ptitle">{title}</h1>
            <span className="sp" />
            {headerExtra}
            <Header title={title} role={role} onToggleCollapse={onToggleCollapse} />
          </header>
          <div className="page">
            <div className="content" onClick={() => setDrawerOpen(false)}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
