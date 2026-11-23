from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "GridGuard AI GIS Backend"
    app_version: str = "3.0.0"
    api_prefix: str = "/api"
    environment: str = "development"
    debug: bool = False

    # Async SQLAlchemy 2.0 + psycopg3 PostGIS connection string
    database_url: str = (
        "postgresql+psycopg://gridguard:gridguard_secret_2026@localhost:5432/gridguard_db"
    )
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_echo: bool = False

    # JWT Security Configuration (override JWT_SECRET_KEY via environment in production)
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION_USE_ENV_SECRET"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 120
    jwt_refresh_token_expire_minutes: int = 1440

    # Demonstration Mode & Rate Limiting
    enable_demonstration_mode: bool = True
    rate_limit_requests_per_minute: int = 300
    rate_limit_auth_per_minute: int = 20

    # Caching & Pagination Defaults
    cache_ttl_seconds: int = 60
    cache_max_entries: int = 512
    default_page_limit: int = 100
    max_page_limit: int = 2000

    # CORS Origins
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
