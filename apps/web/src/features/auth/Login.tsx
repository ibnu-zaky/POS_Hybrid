// features/auth/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../state/store-context";
import { saveSession } from "../../lib/storage";
import { Button } from "../../components/ui/Button";

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 26h31v12a15 15 0 0 1-15 15h-1a15 15 0 0 1-15-15z" />
        <path d="M44 30h3a7 7 0 0 1 0 14h-5" />
        <path d="M21 18q-4-5 0-9M29 18q-4-5 0-9M37 18q-4-5 0-9" />
        <path d="M9 58h38" />
      </g>
    </svg>
  );
}

export function Login() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [role, setRole] = useState<"kasir" | "admin" | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      checkPin(next);
    }
  }

  function checkPin(value: string) {
    const expected = role === "kasir" ? state.settings.pinKasir : state.settings.pinAdmin;
    if (value === expected) {
      saveSession("wk-role", role);
      navigate(role === "kasir" ? "/kasir" : "/admin");
    } else {
      setError("PIN salah. Coba lagi.");
      setPin("");
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
  }

  const roleCards: { id: "kasir" | "admin"; icon: React.ReactNode; title: string; desc: string; radius: string }[] = [
    {
      id: "kasir",
      icon: (
        <svg className="ic" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="28" width="46" height="26" rx="3" />
            <path d="M17 28l4-14h22l4 14M19 38h8M37 38h8M20 46h24" />
          </g>
        </svg>
      ),
      title: "Kasir",
      desc: "Layar kasir di tablet: menu, pesanan masuk, pembayaran.",
      radius: "",
    },
    {
      id: "admin",
      icon: (
        <svg className="ic" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <circle cx="32" cy="32" r="9" />
            <path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" />
          </g>
        </svg>
      ),
      title: "Admin",
      desc: "Menu, kategori, meja dan QR, laporan, pengaturan.",
      radius: "r2",
    },
  ];

  if (!role) {
    return (
      <div className="frame">
        <div className="loginwrap">
          <div className="ltop">
            <div className="brand">
              <Logo />
              <div>
                <h1>{state.settings.storeName}</h1>
                <p>Prototype sistem kasir</p>
              </div>
            </div>
          </div>
          <h2 className="lh">Pilih tampilan</h2>
          <div className="roles">
            {roleCards.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`rolecard box ${r.radius}`.trim()}
                onClick={() => {
                  setRole(r.id);
                  setPin("");
                  setError("");
                }}
              >
                {r.icon}
                <b>{r.title}</b>
                <span>{r.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="frame">
      <div className="loginwrap">
        <div className="ltop">
          <div className="brand">
            <Logo />
            <div>
              <h1>{state.settings.storeName}</h1>
              <p>Prototype sistem kasir</p>
            </div>
          </div>
        </div>
        <div className="pinpanel box r2">
          <h3>PIN {role === "kasir" ? "kasir" : "admin"}</h3>
          <div className="dots">
            {Array.from({ length: 4 }, (_, i) => (
              <i key={i} className={i < pin.length ? "on" : undefined} />
            ))}
          </div>
          <p className="err">{error}</p>
          <div className="keys">
            {keys.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <Button
                  key={i}
                  radius={k === "del" ? "r3" : "r1"}
                  onClick={() => (k === "del" ? handleBackspace() : handleDigit(k))}
                >
                  {k === "del" ? "Hapus" : k}
                </Button>
              )
            )}
          </div>
          <p className="hint center">PIN demo: kasir 1234, admin 9999</p>
          <Button
            variant="link"
            onClick={() => {
              setRole(null);
              setPin("");
              setError("");
            }}
            style={{ width: "100%", marginTop: 8 }}
          >
            Ganti peran
          </Button>
        </div>
      </div>
    </div>
  );
}
