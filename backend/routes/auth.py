from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database.session import get_db_session
from backend.schemas.auth import AuthResponse, LoginRequest, LogoutRequest, LogoutResponse, RefreshRequest
from backend.services.auth_service import AuthenticationError, auth_service

router = APIRouter()


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db_session)) -> AuthResponse:
    try:
        return auth_service.login(
            db,
            payload,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db_session)) -> AuthResponse:
    try:
        return auth_service.refresh(
            db,
            payload,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout", response_model=LogoutResponse)
def logout(payload: LogoutRequest, db: Session = Depends(get_db_session)) -> LogoutResponse:
    return auth_service.logout(db, payload.refresh_token)
