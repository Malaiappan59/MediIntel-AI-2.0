import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth.dependencies import load_permissions
from backend.models.entities import User, UserSession
from backend.schemas.auth import AuthResponse, AuthTokensResponse, LoginRequest, LogoutResponse, RefreshRequest, UserProfileResponse
from backend.utils.security import create_access_token, create_refresh_token, decode_token, hash_token, verify_password
from backend.utils.settings import get_settings

settings = get_settings()


class AuthenticationError(ValueError):
    """Raised when a user cannot be authenticated."""


class AuthService:
    def _build_response(self, db: Session, user: User, session_id: str, refresh_token: str) -> AuthResponse:
        permissions = load_permissions(db, user.role)
        access_token = create_access_token(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            permissions=permissions,
            session_id=session_id,
        )

        return AuthResponse(
            user=UserProfileResponse(
                id=user.id,
                username=user.username,
                full_name=user.full_name,
                email=user.email,
                role=user.role,
                permissions=permissions,
            ),
            tokens=AuthTokensResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=settings.jwt_access_token_expire_minutes * 60,
            ),
        )

    def login(self, db: Session, payload: LoginRequest, ip_address: str | None = None, user_agent: str | None = None) -> AuthResponse:
        user = db.scalar(select(User).where(User.username == payload.username, User.is_active.is_(True)))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise AuthenticationError("Invalid username or password.")

        if user.role != payload.role:
            raise AuthenticationError("Selected role does not match the assigned user role.")

        session_id = f"SES-{secrets.token_hex(8).upper()}"
        refresh_token = create_refresh_token(
            user_id=user.id,
            username=user.username,
            session_id=session_id,
            expires_delta=timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        now = datetime.now(UTC)
        db.add(
            UserSession(
                session_code=session_id,
                username=user.username,
                refresh_token_hash=hash_token(refresh_token),
                ip_address=ip_address,
                user_agent=user_agent,
                issued_at=now,
                expires_at=now + timedelta(days=settings.jwt_refresh_token_expire_days),
                revoked_at=None,
            )
        )
        user.last_login_at = now
        db.commit()
        db.refresh(user)
        return self._build_response(db, user, session_id, refresh_token)

    def refresh(self, db: Session, payload: RefreshRequest, ip_address: str | None = None, user_agent: str | None = None) -> AuthResponse:
        try:
            decoded = decode_token(payload.refresh_token, expected_type="refresh")
        except ValueError as exc:
            raise AuthenticationError("Refresh token is invalid.") from exc

        session = db.scalar(
            select(UserSession).where(
                UserSession.session_code == decoded["sid"],
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.now(UTC),
            )
        )
        if session is None or session.refresh_token_hash != hash_token(payload.refresh_token):
            raise AuthenticationError("Refresh token is not active.")

        user = db.scalar(select(User).where(User.id == int(decoded["sub"]), User.is_active.is_(True)))
        if user is None:
            raise AuthenticationError("User account is inactive.")

        session.revoked_at = datetime.now(UTC)

        next_session_id = f"SES-{secrets.token_hex(8).upper()}"
        next_refresh_token = create_refresh_token(
            user_id=user.id,
            username=user.username,
            session_id=next_session_id,
            expires_delta=timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        now = datetime.now(UTC)
        db.add(
            UserSession(
                session_code=next_session_id,
                username=user.username,
                refresh_token_hash=hash_token(next_refresh_token),
                ip_address=ip_address,
                user_agent=user_agent,
                issued_at=now,
                expires_at=now + timedelta(days=settings.jwt_refresh_token_expire_days),
                revoked_at=None,
            )
        )
        db.commit()
        return self._build_response(db, user, next_session_id, next_refresh_token)

    def logout(self, db: Session, refresh_token: str | None = None) -> LogoutResponse:
        if refresh_token:
            try:
                decoded = decode_token(refresh_token, expected_type="refresh")
            except ValueError:
                return LogoutResponse(message="Session already inactive.")

            session = db.scalar(select(UserSession).where(UserSession.session_code == decoded["sid"]))
            if session is not None and session.revoked_at is None:
                session.revoked_at = datetime.now(UTC)
                db.commit()

        return LogoutResponse(message="Logged out successfully.")


auth_service = AuthService()
