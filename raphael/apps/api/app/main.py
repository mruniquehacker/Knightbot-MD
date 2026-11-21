"""Point d'entrée de l'API RAPHAËL."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core import db
from app.core.config import get_settings
from app.core.security_headers import SecurityHeadersMiddleware
from app.modules.health.router import router as health_router

log = logging.getLogger("raphael")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    try:
        await db.connect(settings.database_url)
    except Exception as exc:  # l'API démarre quand même ; /v1/health indiquera "degraded"
        log.error("Connexion PostgreSQL impossible : %s", exc)
    yield
    await db.disconnect()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RAPHAËL — Personal Intelligence System",
        version=__version__,
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.include_router(health_router, prefix="/v1")
    return app


app = create_app()
