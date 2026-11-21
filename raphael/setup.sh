#!/usr/bin/env bash
# Installe les dépendances de RAPHAËL (API Python + interface Node). Idempotent.
set -euo pipefail
cd "$(dirname "$0")"

( cd apps/api
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q -e '.[dev]'
  [ -f .env ] || cp .env.example .env )

( cd apps/web
  npm install --no-audit --no-fund
  [ -f .env.local ] || cp .env.example .env.local )

echo "✓ Installation terminée. Lancez : ./dev.sh"
