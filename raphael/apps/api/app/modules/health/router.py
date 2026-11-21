"""Sonde de santé : indique honnêtement l'état réel de l'API et de la base."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.core.db import get_pool

router = APIRouter(tags=["health"])


class DatabaseStatus(BaseModel):
    connected: bool
    pgvector: bool
    schema_version: int | None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    database: DatabaseStatus


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    db = DatabaseStatus(connected=False, pgvector=False, schema_version=None)
    pool = get_pool()
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                db.connected = True
                db.pgvector = bool(
                    await conn.fetchval("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
                )
                if await conn.fetchval("SELECT to_regclass('public.schema_migrations')"):
                    db.schema_version = await conn.fetchval(
                        "SELECT max(version) FROM schema_migrations"
                    )
        except Exception:  # base injoignable : on le signale, on ne plante pas
            db.connected = False
    status = "ok" if db.connected and db.pgvector and db.schema_version else "degraded"
    return HealthResponse(status=status, version=__version__, database=db)
