"""Pool de connexions PostgreSQL (asyncpg)."""
import asyncpg

_pool: asyncpg.Pool | None = None


async def connect(dsn: str) -> None:
    global _pool
    _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10, command_timeout=10)


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool | None:
    return _pool
