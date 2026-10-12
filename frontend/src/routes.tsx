// routes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./features/auth/Login";
import { RoleGuard } from "./features/auth/RoleGuard";
import { KasirPage } from "./features/kasir/KasirPage";
import { IncomingOrders } from "./features/kasir/IncomingOrders";
import { Riwayat } from "./features/kasir/Riwayat";
import { AdminRingkasan } from "./features/admin/AdminRingkasan";
import { MenuPage } from "./features/admin/MenuPage";
import { KategoriPage } from "./features/admin/KategoriPage";
import { MejaPage } from "./features/admin/MejaPage";
import { LaporanPage } from "./features/admin/LaporanPage";
import { PengaturanPage } from "./features/admin/PengaturanPage";
import { CustomerMenu } from "./features/customer/CustomerMenu";
import { OrderStatus } from "./features/customer/OrderStatus";
import { useState } from "react";

export function AppRoutes() {
  const [stockMode, setStockMode] = useState(false);
  const [collapsed] = useState(() => {
    try { return localStorage.getItem("wk-sidebar-collapsed") === "true"; } catch { return false; }
  });

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/kasir"
        element={
          <RoleGuard role="kasir">
            <KasirPage />
          </RoleGuard>
        }
      />
      <Route
        path="/kasir/pesanan-masuk"
        element={
          <RoleGuard role="kasir">
            <IncomingOrders
              stockMode={stockMode}
              onToggleStockMode={() => setStockMode(!stockMode)}
              collapsed={collapsed}
            />
          </RoleGuard>
        }
      />
      <Route
        path="/kasir/riwayat"
        element={
          <RoleGuard role="kasir">
            <Riwayat
              stockMode={stockMode}
              onToggleStockMode={() => setStockMode(!stockMode)}
              collapsed={collapsed}
              incomingBadge={0}
            />
          </RoleGuard>
        }
      />

      <Route
        path="/admin"
        element={
          <RoleGuard role="admin">
            <AdminRingkasan />
          </RoleGuard>
        }
      />
      <Route path="/admin/menu" element={<RoleGuard role="admin"><MenuPage /></RoleGuard>} />
      <Route path="/admin/kategori" element={<RoleGuard role="admin"><KategoriPage /></RoleGuard>} />
      <Route path="/admin/meja" element={<RoleGuard role="admin"><MejaPage /></RoleGuard>} />
      <Route path="/admin/laporan" element={<RoleGuard role="admin"><LaporanPage /></RoleGuard>} />
      <Route path="/admin/pengaturan" element={<RoleGuard role="admin"><PengaturanPage /></RoleGuard>} />

      {/* rute publik pelanggan */}
      <Route path="/m/:meja" element={<CustomerPageWrapper />} />
      <Route path="/m/:meja/status" element={<CustomerStatusWrapper />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function CustomerPageWrapper() {
  const path = window.location.pathname;
  const match = path.match(/^\/m\/([^/]+)/);
  const meja = match ? match[1] : "?";
  return <CustomerMenu meja={decodeURIComponent(meja)} />;
}

function CustomerStatusWrapper() {
  const path = window.location.pathname;
  const match = path.match(/^\/m\/([^/]+)\/status/);
  const meja = match ? match[1] : "?";
  return <OrderStatus meja={decodeURIComponent(meja)} />;
}
