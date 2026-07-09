from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.dashboard import DashboardResponse
from backend.services.dashboard_service import dashboard_service

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> DashboardResponse:
    try:
        return DashboardResponse(**dashboard_service.get_dashboard(db, current_user))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
