from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser, get_current_user
from backend.database.session import get_db_session
from backend.schemas.forecast import ForecastPointResponse
from backend.services.forecast_service import forecast_service

router = APIRouter()


@router.get("/forecast", response_model=list[ForecastPointResponse])
def list_forecasts(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[ForecastPointResponse]:
    return [ForecastPointResponse(**point) for point in forecast_service.list_forecasts(db)]
