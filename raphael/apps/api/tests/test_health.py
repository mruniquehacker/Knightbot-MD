from httpx import ASGITransport, AsyncClient

from app.core import db
from app.main import create_app


async def test_health_degraded_without_database(monkeypatch):
    monkeypatch.setattr(db, "_pool", None)
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "degraded"
    assert body["database"]["connected"] is False
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"


async def test_health_ok_with_migrated_database(test_dsn):
    from scripts.migrate import migrate

    await migrate(test_dsn)
    await db.connect(test_dsn)
    try:
        app = create_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            body = (await c.get("/v1/health")).json()
        assert body == {
            "status": "ok",
            "version": "0.1.0",
            "database": {"connected": True, "pgvector": True, "schema_version": 1},
        }
    finally:
        await db.disconnect()
