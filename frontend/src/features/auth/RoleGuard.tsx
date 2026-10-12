// features/auth/RoleGuard.tsx
import { Navigate, useLocation } from "react-router-dom";
import { loadSession } from "../../lib/storage";
import type { ReactNode } from "react";

type Role = "kasir" | "admin";

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const current = loadSession<Role | null>("wk-role", null);
  const location = useLocation();

  if (!current) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // kasir tidak boleh buka /admin; admin boleh buka /kasir
  if (role === "admin" && current !== "admin") {
    return <Navigate to="/kasir" replace />;
  }

  return <>{children}</>;
}
