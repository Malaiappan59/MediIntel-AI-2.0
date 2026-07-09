from sqlalchemy.orm import Session

from backend.services.erp_queries import list_forecasts


class ForecastService:
    def list_forecasts(self, db: Session) -> list[dict]:
        return list_forecasts(db)


forecast_service = ForecastService()
