#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "[INFO] File .env dibuat dari .env.example. Edit DATABASE_URL dan secret di backend/.env jika diperlukan."
fi

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -n 1 | cut -d= -f2- || true)"
if [[ -n "$DATABASE_URL" ]] && ! grep -Eq '^ADMIN_DATABASE_URL=' "$BACKEND_DIR/.env"; then
  printf '\nADMIN_DATABASE_URL=%s\n' "$DATABASE_URL" >> "$BACKEND_DIR/.env"
  echo "[INFO] ADMIN_DATABASE_URL ditambahkan otomatis dari DATABASE_URL untuk kebutuhan migrasi lokal."
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[INFO] Menginstall dependency frontend..."
  (cd "$FRONTEND_DIR" && npm install)
fi

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  echo "[INFO] Menginstall dependency backend..."
  (cd "$BACKEND_DIR" && npm install)
fi

if command -v psql >/dev/null 2>&1; then
  if ! psql -lqt 2>/dev/null | cut -d '|' -f 1 | tr -d ' ' | grep -qx "pos_hybrid"; then
    echo "[INFO] Database 'pos_hybrid' belum ada. Membuat database..."
    createdb pos_hybrid 2>/dev/null || true
  fi
else
  echo "[WARN] psql tidak ditemukan; pastikan PostgreSQL sudah terinstall dan database 'pos_hybrid' sudah ada."
fi

echo "[INFO] Menjalankan migrasi database..."
(cd "$BACKEND_DIR" && npm run migrate)

echo "[INFO] Seed data development..."
(cd "$BACKEND_DIR" && npm run seed-dev)

echo "[INFO] Menjalankan backend..."
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!

sleep 3

cd "$FRONTEND_DIR"
echo "[INFO] Menjalankan frontend..."
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

cleanup() {
  echo "[INFO] Menutup proses..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo
echo "Aplikasi sedang berjalan."
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000"
echo "Tekan Ctrl+C untuk stop semua proses."
wait "$BACKEND_PID" "$FRONTEND_PID"
