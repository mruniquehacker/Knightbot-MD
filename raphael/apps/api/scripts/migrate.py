"""Applique les migrations SQL (migrations/NNN_*.sql) dans l'ordre, chacune dans une
transaction, et enregistre la version appliquée dans schema_migrations.

Usage : python -m scripts.migrate            (utilise RAPHAEL_DATABASE_URL)
"""
import asyncio
import re
import sys
from pathlib import Path

import asyncpg

from app.core.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
PATTERN = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")


def discover() -> list[tuple[int, Path]]:
    found = []
    for path in sorted(MIGRATIONS_DIR.iterdir()):
        if m := PATTERN.match(path.name):
            found.append((int(m.group(1)), path))
    versions = [v for v, _ in found]
    if len(versions) != len(set(versions)):
        raise SystemExit("Numéros de migration en double.")
    return found


async def migrate(dsn: str) -> list[int]:
    conn = await asyncpg.connect(dsn)
    applied_now: list[int] = []
    try:
        await conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version integer PRIMARY KEY,
                   name text NOT NULL,
                   applied_at timestamptz NOT NULL DEFAULT now())"""
        )
        # Verrou consultatif : empêche deux migrations simultanées.
        await conn.execute("SELECT pg_advisory_lock(727274)")
        done = {r["version"] for r in await conn.fetch("SELECT version FROM schema_migrations")}
        for version, path in discover():
            if version in done:
                continue
            async with conn.transaction():
                await conn.execute(path.read_text(encoding="utf-8"))
                await conn.execute(
                    "INSERT INTO schema_migrations(version, name) VALUES ($1, $2)",
                    version, path.name,
                )
            applied_now.append(version)
            print(f"✓ migration {path.name} appliquée")
        await conn.execute("SELECT pg_advisory_unlock(727274)")
    finally:
        await conn.close()
    if not applied_now:
        print("Base à jour.")
    return applied_now


if __name__ == "__main__":
    dsn = sys.argv[1] if len(sys.argv) > 1 else get_settings().database_url
    asyncio.run(migrate(dsn))
