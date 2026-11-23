from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    AuthenticatedUser,
    authenticate_registered_user,
    create_access_token,
    create_refresh_token,
    register_user_account,
    revoke_refresh_token,
    verify_refresh_token,
)
from app.schemas.common import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a utility operator account with salted scrypt password hash",
)
async def register_user(payload: RegisterRequest) -> TokenResponse:
    account = register_user_account(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        role=payload.role,
    )
    access_token = create_access_token(
        subject=account["username"],
        email=account["email"],
        full_name=account["full_name"],
        role=account["role"],
    )
    refresh_token = create_refresh_token(
        subject=account["username"],
        email=account["email"],
        full_name=account["full_name"],
        role=account["role"],
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=account["role"],
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        refresh_expires_in_minutes=settings.jwt_refresh_token_expire_minutes,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate operator credentials and issue JWT access + refresh tokens",
)
async def login_user(payload: LoginRequest) -> TokenResponse:
    account = authenticate_registered_user(payload.identifier, payload.password)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid operator credentials.",
        )
    access_token = create_access_token(
        subject=account["username"],
        email=account["email"],
        full_name=account["full_name"],
        role=account["role"],
    )
    refresh_token = create_refresh_token(
        subject=account["username"],
        email=account["email"],
        full_name=account["full_name"],
        role=account["role"],
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=account["role"],
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        refresh_expires_in_minutes=settings.jwt_refresh_token_expire_minutes,
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Issue Demonstration Mode JWT Bearer Token for GIS RBAC Roles",
)
async def issue_token(payload: TokenRequest) -> TokenResponse:
    if not settings.enable_demonstration_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demonstration role token issuance is disabled in production mode.",
        )
    email = payload.email or f"{payload.username}@gridguard.local"
    full_name = payload.full_name or payload.username.replace(".", " ").title()
    token = create_access_token(
        subject=payload.username,
        email=email,
        full_name=full_name,
        role=payload.role,
    )
    refresh_token = create_refresh_token(
        subject=payload.username,
        email=email,
        full_name=full_name,
        role=payload.role,
    )
    return TokenResponse(
        access_token=token,
        refresh_token=refresh_token,
        role=payload.role,
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        refresh_expires_in_minutes=settings.jwt_refresh_token_expire_minutes,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate Refresh Token and Issue Fresh Access Token",
)
async def refresh_session(payload: RefreshTokenRequest) -> TokenResponse:
    claims = verify_refresh_token(payload.refresh_token)
    revoke_refresh_token(payload.refresh_token)
    access_token = create_access_token(
        subject=claims.sub,
        email=claims.email,
        full_name=claims.full_name,
        role=claims.role,
    )
    next_refresh = create_refresh_token(
        subject=claims.sub,
        email=claims.email,
        full_name=claims.full_name,
        role=claims.role,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=next_refresh,
        role=claims.role,
        expires_in_minutes=settings.jwt_access_token_expire_minutes,
        refresh_expires_in_minutes=settings.jwt_refresh_token_expire_minutes,
    )


@router.post(
    "/logout",
    summary="Revoke active Refresh Token on sign-out",
)
async def logout_session(payload: RefreshTokenRequest) -> dict:
    revoke_refresh_token(payload.refresh_token)
    return {"status": "signed_out"}


@router.get(
    "/me",
    response_model=AuthenticatedUser,
    summary="Inspect Authenticated User Claims",
)
async def read_current_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    return current_user
