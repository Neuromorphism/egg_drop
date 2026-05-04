#!/usr/bin/env bash
# Start the egg drop simulator (backend + frontend)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🥚  Egg Drop Simulator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend
echo "▶ Starting physics backend (FastAPI + Pymunk)…"
cd "$ROOT/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
echo "▶ Starting frontend (Vite + React)…"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

cleanup() {
  echo ""
  echo "Stopping servers…"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
