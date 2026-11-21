#!/usr/bin/env bash
# Lance l'API RAPHAËL (port 8000) et l'interface (port 3000) ensemble.
# Ctrl+C arrête les deux.
set -euo pipefail
cd "$(dirname "$0")"

if ! ( cd apps/api && .venv/bin/python -m scripts.migrate ); then
  echo "✗ Base de données injoignable. Vérifiez que PostgreSQL (pgvector) est démarré." >&2
  exit 1
fi

( cd apps/api && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 ) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

cd apps/web && exec npm run dev -- -H 0.0.0.0 -p 3000
