from datetime import datetime, timedelta, timezone
from enum import Enum
import hashlib
import hmac
import secrets
from typing import Any, Dict, Optional, Set
import jwt
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import get_settings


class UserRole(str, Enum):
    ADMINISTRATOR = "Administrator"
    UTILITY_MANAGER = "Utility Manager"
    CONTROL_ROOM_ENGINEER = "Control Room Engineer"
    FIELD_ENGINEER = "Field Engineer"
    VIEWER = "Viewer"


WRITE_ALLOWED_ROLES = {
    UserRole.ADMINISTRATOR,
    UserRole.UTILITY_MANAGER,
    UserRole.CONTROL_ROOM_ENGINEER,
    UserRole.FIELD_ENGINEER,
}

DELETE_ALLOWED_ROLES = {
    UserRole.ADMINISTRATOR,
    UserRole.UTILITY_MANAGER,
}


class TokenPayload(BaseModel):
    sub: str
    email: str
    full_name: str
    role: UserRole
    exp: int
    token_type: str = "access"
    jti: Optional[str] = None


class AuthenticatedUser(BaseModel):
    username: str
    email: str
    full_name: str
    role: UserRole


bearer_scheme = HTTPBearer(auto_error=False)
_REVOKED_REFRESH_JTIS: Set[str] = set()
_REGISTERED_ACCOUNTS: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash a password using salted scrypt for safe storage."""
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    used_salt = salt or secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=used_salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=32,
    )
    return f"scrypt${used_salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored salted scrypt hash."""
    try:
        scheme, salt, digest_hex = stored_hash.split("$", 2)
        if scheme != "scrypt":
            return False
        candidate = hash_password(password, salt=salt)
        return hmac.compare_digest(candidate, stored_hash)
    except Exception:
        return False


def register_user_account(
    username: str,
    email: str,
    full_name: str,
    password: str,
    role: UserRole,
) -> Dict[str, Any]:
    key = email.strip().lower()
    if key in _REGISTERED_ACCOUNTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{email}' already exists.",
        )
    record = {
        "username": username.strip(),
        "email": key,
        "full_name": full_name.strip(),
        "role": role,
        "password_hash": hash_password(password),
    }
    _REGISTERED_ACCOUNTS[key] = record
    return record


def authenticate_registered_user(identifier: str, password: str) -> Optional[Dict[str, Any]]:
    lookup = identifier.strip().lower()
    account = _REGISTERED_ACCOUNTS.get(lookup)
    if account is None:
        account = next(
            (acc for acc in _REGISTERED_ACCOUNTS.values() if acc["username"].lower() == lookup),
            None,
        )
    if account is None:
        return None
    if not verify_password(password, account["password_hash"]):
        return None
    return account


def create_access_token(
    subject: str,
    email: str,
    full_name: str,
    role: UserRole,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Issue a signed JWT access token embedding canonical identity & RBAC role."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload: Dict[str, Any] = {
        "sub": subject,
        "email": email,
        "full_name": full_name,
        "role": role.value,
        "token_type": "access",
        "jti": secrets.token_hex(12),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(
    subject: str,
    email: str,
    full_name: str,
    role: UserRole,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Issue a signed JWT refresh token with unique jti for rotation & revocation."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_refresh_token_expire_minutes)
    )
    payload: Dict[str, Any] = {
        "sub": subject,
        "email": email,
        "full_name": full_name,
        "role": role.value,
        "token_type": "refresh",
        "jti": secrets.token_hex(16),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AuthenticatedUser:
    """Verify JWT access signature, expiry, token_type, and role claim."""
    settings = get_settings()
    try:
        decoded = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        token_data = TokenPayload(**decoded)
        if token_data.token_type not in ("access", ""):
            raise ValueError("Invalid token type")
        return AuthenticatedUser(
            username=token_data.sub,
            email=token_data.email,
            full_name=token_data.full_name,
            role=token_data.role,
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def verify_refresh_token(token: str) -> TokenPayload:
    """Verify a refresh token signature, expiry, type, and non-revoked jti."""
    settings = get_settings()
    try:
        decoded = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        token_data = TokenPayload(**decoded)
        if token_data.token_type != "refresh":
            raise ValueError("Not a refresh token")
        if token_data.jti and token_data.jti in _REVOKED_REFRESH_JTIS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked.",
            )
        return token_data
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        ) from exc


def revoke_refresh_token(token: str) -> None:
    try:
        payload = verify_refresh_token(token)
        if payload.jti:
            _REVOKED_REFRESH_JTIS.add(payload.jti)
    except Exception:
        pass


def extract_user_from_credentials(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer JWT token for protected operation.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_access_token(credentials.credentials)
