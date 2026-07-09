from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database.session import get_db_session
from backend.models.entities import Permission, Role, RolePermission, User, UserSession
from backend.utils.security import decode_access_token

http_bearer = HTTPBearer(auto_error=False)


@dataclass(slots=True)
class CurrentUser:
    id: int
    username: str
    full_name: str
    email: str
    role: str
    permissions: list[str]
    session_id: str


def load_permissions(db: Session, role_name: str) -> list[str]:
    statement = (
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(Role, Role.id == RolePermission.role_id)
        .where(Role.name == role_name)
        .order_by(Permission.code.asc())
    )
    return list(db.scalars(statement).all())


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db: Session = Depends(get_db_session),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    session_id = str(payload.get("sid") or "")
    session = db.scalar(
        select(UserSession).where(
            UserSession.session_code == session_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(UTC),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is not active.")

    user = db.scalar(
        select(User).where(
            User.id == int(payload["sub"]),
            User.is_active.is_(True),
        )
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive.")

    permissions = load_permissions(db, user.role)
    return CurrentUser(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        permissions=permissions,
        session_id=session_id,
    )


def require_permissions(*required_codes: str):
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        missing = [code for code in required_codes if code not in current_user.permissions]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return current_user

    return dependency
