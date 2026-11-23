from typing import AsyncGenerator, Callable
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    AuthenticatedUser,
    UserRole,
    bearer_scheme,
    extract_user_from_credentials,
)
from app.database.session import get_db_session

settings = get_settings()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """Validate Bearer JWT token and return authenticated user identity."""
    return extract_user_from_credentials(credentials)


def require_roles(*allowed_roles: UserRole) -> Callable[[AuthenticatedUser], AuthenticatedUser]:
    """Role-based access control dependency for protected write operations."""
    allowed_set = set(allowed_roles)

    def _role_checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{current_user.role.value}' is not authorized for this operation. "
                    f"Allowed roles: {[r.value for r in allowed_roles]}."
                ),
            )
        return current_user

    return _role_checker


class PaginationParams:
    def __init__(
        self,
        limit: int = Query(
            default=settings.default_page_limit,
            ge=1,
            le=settings.max_page_limit,
            description="Maximum records to return per page.",
        ),
        offset: int = Query(
            default=0,
            ge=0,
            description="Zero-based row offset for pagination.",
        ),
    ) -> None:
        self.limit = limit
        self.offset = offset
