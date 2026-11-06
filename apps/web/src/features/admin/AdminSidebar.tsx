// features/admin/AdminSidebar.tsx
import { NavLink } from "react-router-dom";
import { useStore } from "../../state/store-context";
import { useNavigate } from "react-router-dom";
import { removeSession } from "../../lib/storage";

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="ic">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 26h31v12a15 15 0 0 1-15 15h-1a15 15 0 0 1-15-15z" />
        <path d="M44 30h3a7 7 0 0 1 0 14h-5" />
        <path d="M21 18q-4-5 0-9M29 18q-4-5 0-9M37 18q-4-5 0-9" />
        <path d="M9 58h38" />
      </g>
    </svg>
  );
}

const NAV = [
  { to: "/admin", end: true, label: "Ringkasan" },
  { to: "/admin/menu", end: false, label: "Menu" },
  { to: "/admin/kategori", end: false, label: "Kategori" },
  { to: "/admin/meja", end: false, label: "Meja dan QR" },
  { to: "/admin/laporan", end: false, label: "Laporan" },
  { to: "/admin/pengaturan", end: false, label: "Pengaturan" },
];

export function AdminSidebar() {
  const { state } = useStore();
  const navigate = useNavigate();

  return (
    <>
      <div className="sbrand">
        <Logo />
        <b className="lbl">{state.settings.storeName}</b>
      </div>
      <nav className="snav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `navi${isActive ? " on" : ""}`}
          >
            <span className="lbl">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sscroll" />
      <div className="sfoot">
        <div className="who">Admin</div>
        <button
          type="button"
          className="navi"
          onClick={() => {
            removeSession("wk-role");
            navigate("/login");
          }}
        >
          <span className="lbl">Keluar</span>
        </button>
      </div>
    </>
  );
}
