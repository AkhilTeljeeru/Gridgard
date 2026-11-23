from contextlib import asynccontextmanager
import logging
import time
from typing import AsyncGenerator, Dict, Any
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import api_router
from app.api.routes.ws import ws_manager
from app.core.config import get_settings
from app.database.session import AsyncSessionLocal, ensure_postgis_extension
from app.ml.scheduler import ai_scheduler
from app.schemas.common import HealthResponse

logger = logging.getLogger("gridguard.gis")
settings = get_settings()
APP_STARTED_AT = time.monotonic()

_MONITORING_STATS: Dict[str, Any] = {
    "total_requests": 0,
    "error_count": 0,
    "failed_logins": 0,
    "total_latency_ms": 0.0,
}


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize PostGIS extension and AI background scheduler cleanly."""
    try:
        await ensure_postgis_extension()
        logger.info("PostGIS extension verified on PostgreSQL startup.")
    except Exception as exc:
        logger.warning("Startup PostGIS verification deferred (DB unreachable): %s", exc)
    ai_scheduler.start()
    try:
        yield
    finally:
        await ai_scheduler.stop()


OPENAPI_TAGS = [
    {"name": "Health", "description": "GIS service liveness, PostGIS, AI, and WebSocket health checks"},
    {"name": "Authentication", "description": "JWT Bearer authentication, refresh tokens, and RBAC roles"},
    {"name": "Geography", "description": "Cascading Country -> State -> District -> City -> Area filters"},
    {"name": "Utility Assets", "description": "Canonical electrical asset CRUD and spatial radius/bbox queries"},
    {"name": "Grid GeoJSON Layers", "description": "RFC 7946 GeoJSON FeatureCollection layers for Mapbox GL JS"},
    {"name": "Search & Corridor Routing", "description": "Unified asset/geography search and electrical feeder routing"},
    {"name": "What-If Simulations", "description": "Operational what-if simulation scenarios and risk analysis"},
    {"name": "Decision Governance & Field Operations", "description": "Decision approvals, field tasks, evidence collection, verification, and audit trail"},
    {"name": "AI Predictive Intelligence", "description": "Asset health scores, failure predictions, grid risk index, incident patterns, and explainable recommendations"},
    {"name": "Real-Time WebSocket Streaming", "description": "Live telemetry, alert, and grid event streaming"},
]

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "High-performance GIS & Spatial Backend for GridGuard AI powered by "
        "FastAPI, async SQLAlchemy 2.0, GeoAlchemy2, Shapely, GeoPandas, and PostgreSQL/PostGIS."
    ),
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_and_monitoring_middleware(request: Request, call_next) -> Response:
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    _MONITORING_STATS["total_requests"] += 1
    _MONITORING_STATS["total_latency_ms"] += elapsed_ms
    if response.status_code >= 500:
        _MONITORING_STATS["error_count"] += 1
    if request.url.path.endswith("/auth/login") and response.status_code == 401:
        _MONITORING_STATS["failed_logins"] += 1

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(api_router, prefix=settings.api_prefix)
# Expose root WebSocket route /ws/grid in addition to /api/ws/grid
app.include_router(api_router)


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Service, PostGIS, AI & WebSocket Health Check",
)
async def health_check() -> HealthResponse:
    postgis_ready = False
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT PostGIS_Version();"))
            postgis_ready = result.scalar_one_or_none() is not None
    except Exception:
        postgis_ready = False

    uptime_seconds = round(time.monotonic() - APP_STARTED_AT, 2)
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        postgis_enabled=postgis_ready,
        api_status="HEALTHY",
        database_status="CONNECTED" if postgis_ready else "DEGRADED_OR_OFFLINE",
        ai_service_status="HEALTHY",
        websocket_status="ACTIVE",
        active_ws_connections=len(ws_manager.active_connections),
        uptime_seconds=uptime_seconds,
        error_count=_MONITORING_STATS["error_count"],
    )


@app.get(
    "/api/monitoring/metrics",
    tags=["Health"],
    summary="Runtime API latency, failed login, and WebSocket metrics",
)
async def monitoring_metrics() -> Dict[str, Any]:
    total = _MONITORING_STATS["total_requests"]
    avg_latency = round(_MONITORING_STATS["total_latency_ms"] / total, 2) if total > 0 else 0.0
    return {
        "uptime_seconds": round(time.monotonic() - APP_STARTED_AT, 2),
        "total_requests": total,
        "error_count": _MONITORING_STATS["error_count"],
        "failed_logins": _MONITORING_STATS["failed_logins"],
        "avg_latency_ms": avg_latency,
        "active_ws_connections": len(ws_manager.active_connections),
        "demo_mode": settings.enable_demonstration_mode,
    }
