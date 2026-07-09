import base64
import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from backend.utils.settings import get_settings

settings = get_settings()


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived_key = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${_b64encode(salt)}${_b64encode(derived_key)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, encoded_salt, encoded_hash = password_hash.split("$")
    except ValueError:
        return False

    if algorithm != "scrypt":
        return False

    salt = _b64decode(encoded_salt)
    expected = _b64decode(encoded_hash)
    candidate = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(candidate, expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    *,
    user_id: int,
    username: str,
    full_name: str,
    role: str,
    permissions: list[str],
    session_id: str,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    payload = {
        "sub": str(user_id),
        "username": username,
        "name": full_name,
        "role": role,
        "permissions": permissions,
        "sid": session_id,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.get_jwt_secret_key(), algorithm=settings.jwt_algorithm)


def create_refresh_token(*, user_id: int, username: str, session_id: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(days=settings.jwt_refresh_token_expire_days))
    payload = {
        "sub": str(user_id),
        "username": username,
        "sid": session_id,
        "type": "refresh",
        "jti": secrets.token_urlsafe(24),
        "exp": expire,
    }
    return jwt.encode(payload, settings.get_jwt_secret_key(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return decode_token(token, expected_type="access")


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.get_jwt_secret_key(), algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid JWT token") from exc

    token_type = payload.get("type")
    if expected_type and token_type != expected_type:
        raise ValueError("Invalid JWT token type")

    return payload
