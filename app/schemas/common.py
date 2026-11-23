from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import UserRole

T = TypeVar("T")


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool


class PaginatedResponse(BaseModel, Generic[T]):
    meta: PaginationMeta
    items: List[T]
    geojson: Optional[Dict[str, Any]] = None


class TokenRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)
    role: UserRole = Field(default=UserRole.VIEWER)
    email: Optional[str] = None
    full_name: Optional[str] = None


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., min_length=5, max_length=160)
    full_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = Field(default=UserRole.VIEWER)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=2, max_length=160)
    password: str = Field(..., min_length=8, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=16)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    role: UserRole
    expires_in_minutes: int
    refresh_expires_in_minutes: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    postgis_enabled: bool = True
    api_status: str = "HEALTHY"
    database_status: str = "UNKNOWN"
    ai_service_status: str = "HEALTHY"
    websocket_status: str = "ACTIVE"
    active_ws_connections: int = 0
    uptime_seconds: float = 0.0
    error_count: int = 0


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
