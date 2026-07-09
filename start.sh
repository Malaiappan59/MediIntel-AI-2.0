#!/bin/bash
set -euo pipefail

export PORT="${PORT:-3000}"
export BACKEND_PORT="${BACKEND_PORT:-8000}"
export HOSTNAME="0.0.0.0"

python3 -m backend.utils.bootstrap

python3 -m uvicorn backend.main:app --host 0.0.0.0 --port "${BACKEND_PORT}" &
BACKEND_PID=$!

cd /app/frontend
PORT="${PORT}" HOSTNAME="${HOSTNAME}" node server.js &
FRONTEND_PID=$!

shutdown() {
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
}

trap shutdown SIGINT SIGTERM

while kill -0 "${BACKEND_PID}" 2>/dev/null && kill -0 "${FRONTEND_PID}" 2>/dev/null; do
  sleep 2
done

shutdown
wait "${BACKEND_PID}" 2>/dev/null || true
wait "${FRONTEND_PID}" 2>/dev/null || true
exit 1
