"""Configuration centralisée. Toutes les valeurs sensibles viennent de l'environnement
(fichier .env en développement) et ne sont jamais exposées au client."""
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAPHAEL_", extra="ignore")

    env: str = Field(default="development", pattern="^(development|test|production)$")
    database_url: str = "postgresql://raphael:raphael@localhost:5432/raphael"
    # Origine(s) du frontend autorisées par CORS (séparées par des virgules).
    cors_origins: str = "http://localhost:3000"
    # Dimension des embeddings : doit correspondre à la migration (vector(1024)).
    embedding_dim: int = 1024

    # Clés des fournisseurs IA — utilisées à partir des phases 3 à 5.
    llm_api_key: SecretStr | None = None
    embedding_api_key: SecretStr | None = None
    voice_api_key: SecretStr | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
