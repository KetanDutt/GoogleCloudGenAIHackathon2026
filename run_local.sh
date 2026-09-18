#!/usr/bin/env bash
# Non-destructive local setup. Never invokes cloud deployment/reset commands or deletes data; the app honors your existing configuration.
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo 'Python 3.11+ is required.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'Node.js 22.12+ and npm are required.' >&2; exit 1; }
python3 -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required"'
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env.local ]] || cp frontend/.env.example frontend/.env.local
.venv/bin/python -m pip install -r backend/requirements.txt
(cd frontend && npm ci)
backend_pid=""
frontend_pid=""
cleanup() {
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8080 --no-access-log &
backend_pid=$!
(cd frontend && exec ./node_modules/.bin/next dev --hostname 0.0.0.0 --port 3000) &
frontend_pid=$!
echo 'Workspace: http://localhost:3000 — Ctrl+C stops both servers; your data is kept.'
# Keep the launcher alive until either child exits. Bash 3.2 on macOS has no wait -n.
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
